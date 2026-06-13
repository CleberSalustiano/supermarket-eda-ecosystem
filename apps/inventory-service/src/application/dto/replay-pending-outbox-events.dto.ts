export interface ReplayPendingOutboxEventsOutputDto {
  scannedEvents: number;
  publishedEvents: number;
  stillPendingEvents: number;
  processedEventIds: string[];
}
