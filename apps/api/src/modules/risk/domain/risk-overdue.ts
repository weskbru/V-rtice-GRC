export function isOverdueReview(nextReviewOn: Date | undefined, referenceDate: Date): boolean {
  if (!nextReviewOn) {
    return false;
  }
  return nextReviewOn.getTime() < referenceDate.getTime();
}
