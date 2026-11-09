package app

import (
	"context"
	"errors"
	"os"
	"time"

	"github.com/SophearithSaing/sheldon/internal/github"
	"github.com/SophearithSaing/sheldon/internal/githubpr"
)

// RefreshPRMetadata serializes explicit observations without holding the writer mutex over gh.
func (i *instance) RefreshPRMetadata(ctx context.Context, pr githubpr.PullRequest) (githubpr.LibraryRow, error) {
	if pr.Validate() != nil {
		return githubpr.LibraryRow{}, os.ErrNotExist
	}
	i.mu.Lock()
	index, err := i.readPRIndex()
	if err != nil {
		i.mu.Unlock()
		return githubpr.LibraryRow{}, err
	}
	found := false
	for _, saved := range index.PRs {
		if saved.ID == pr.ID {
			pr, found = saved, true
			break
		}
	}
	if !found {
		i.mu.Unlock()
		return githubpr.LibraryRow{}, os.ErrNotExist
	}
	if i.metadataRefreshing[pr.ID] {
		i.mu.Unlock()
		return githubpr.LibraryRow{}, githubpr.ErrMetadataBusy
	}
	if i.metadataRefreshing == nil {
		i.metadataRefreshing = make(map[string]bool)
	}
	i.metadataRefreshing[pr.ID] = true
	i.mu.Unlock()
	defer i.finishMetadataRefresh(pr.ID)
	request, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	metadata, err := github.ReadDisplayMetadata(request, pr)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return githubpr.LibraryRow{}, context.DeadlineExceeded
		}
		return githubpr.LibraryRow{}, err
	}
	if err := request.Err(); err != nil {
		return githubpr.LibraryRow{}, err
	}
	return i.savePRMetadata(metadata)
}

// finishMetadataRefresh releases the exact per-PR slot after command cleanup and saving.
func (i *instance) finishMetadataRefresh(prID string) {
	i.mu.Lock()
	defer i.mu.Unlock()
	delete(i.metadataRefreshing, prID)
}
