<script setup lang="ts">
import OpenReviewForm from '../components/reviews/OpenReviewForm.vue'
import ComingSoon from '../components/reviews/ComingSoon.vue'
import { navigate } from '../composables/navigation'
import AssetLicenses from '../components/ui/AssetLicenses.vue'
</script>

<template>
  <OpenReviewForm @opened="navigate" />
  <ComingSoon title="Your pull requests, together" description="Search and browse your registered pull requests from one place." />
  <AssetLicenses />
</template>
