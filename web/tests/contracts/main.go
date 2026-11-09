// Command contracts validates development DTOs against the real Go public contracts offline.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"reflect"

	"github.com/SophearithSaing/sheldon/internal/githubpr"
	"github.com/SophearithSaing/sheldon/internal/httpapi"
	"github.com/SophearithSaing/sheldon/internal/question"
	"github.com/SophearithSaing/sheldon/internal/quiz"
	"github.com/SophearithSaing/sheldon/internal/semantic"
)

// payload contains only public transport fixtures, never native bindings or credentials.
type payload struct {
	PR       githubpr.PullRequest    `json:"pr"`
	Source   httpapi.SourceResult    `json:"source"`
	Initial  question.InitialRequest `json:"initial"`
	Answer   question.Answer         `json:"answer"`
	List     question.ThreadList     `json:"list"`
	Detail   question.ThreadDetail   `json:"detail"`
	Quiz     quiz.ReadResult         `json:"quiz"`
	Checked  []quiz.Checked          `json:"checked"`
	Semantic semantic.ReadResult     `json:"semantic"`
}

// registry validates membership without fetching source or starting native work.
type registry struct{ pr githubpr.PullRequest }

// ReadPR returns only the fixture's canonical registered identity.
func (r registry) ReadPR(id string) (githubpr.PullRequest, error) {
	if r.pr.ID != id {
		return githubpr.PullRequest{}, os.ErrNotExist
	}
	return r.pr, nil
}

// validate checks actual backend decoders, identity contracts and public result validators.
func validate(input payload) error {
	if input.PR.Validate() != nil || input.Source.PR.Validate() != nil || input.Source.PR.ID != input.PR.ID || input.Source.State != "ready" || input.Source.Diff == nil || !input.Source.Diff.Complete {
		return errors.New("invalid PR/source contract")
	}
	id, err := input.Source.Diff.Revision.ID()
	if err != nil || id != input.Source.Diff.RevisionID || input.Initial.Validate(input.PR.ID, registry{input.PR}) != nil {
		return errors.New("invalid revision/question contract")
	}
	answer := input.Answer
	if answer.PRID != input.PR.ID || answer.RevisionID != id || !githubpr.ValidID(answer.ID) || !githubpr.ValidID(answer.ThreadID) || answer.Reference.RevisionID != id || answer.Reference.Anchor != input.Initial.Anchor || answer.Question != input.Initial.Question || !question.ValidText(answer.Text) {
		return errors.New("invalid answer contract")
	}
	if input.List.PRID != input.PR.ID || input.Detail.PRID != input.PR.ID || input.List.Version != input.Detail.Version || len(input.List.Threads) != 1 || input.List.Threads[0].ID != answer.ThreadID || input.Detail.ID != answer.ThreadID || input.Detail.Context.RevisionID != id || input.Detail.Context.Anchor != input.Initial.Anchor || len(input.Detail.Answers) != 1 || !reflect.DeepEqual(input.Detail.Answers[0], answer) {
		return errors.New("invalid saved history contract")
	}
	if err := input.Quiz.Validate(input.PR.ID); err != nil {
		return err
	}
	for _, checked := range input.Checked {
		if err := checked.Validate(input.PR.ID); err != nil {
			return err
		}
	}
	return input.Semantic.Validate(input.PR.ID)
}

// main reads bounded test input and prints no source, tokens or private data.
func main() {
	decoder := json.NewDecoder(io.LimitReader(os.Stdin, 4<<20))
	decoder.DisallowUnknownFields()
	var input payload
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || validate(input) != nil {
		fmt.Fprintln(os.Stderr, "public web contract validation failed")
		os.Exit(1)
	}
	fmt.Fprintln(os.Stdout, "public web contracts validated")
}
