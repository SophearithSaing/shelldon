<script setup lang="ts">
import OpenReviewForm from '../components/reviews/OpenReviewForm.vue'
import PRLibrary from '../components/reviews/PRLibrary.vue'
import { navigate } from '../composables/navigation'
import AssetLicenses from '../components/ui/AssetLicenses.vue'
</script>

<template>
  <OpenReviewForm @opened="navigate" />
  <PRLibrary />
  <AssetLicenses />
</template>
