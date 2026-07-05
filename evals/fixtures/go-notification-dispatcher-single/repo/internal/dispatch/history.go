package dispatch

// DeliveryRecord is one logged attempt to deliver a notification to a
// subscriber.
type DeliveryRecord struct {
	SubscriberID string
	Message      string
	StatusCode   int
}

var deliveryLog []DeliveryRecord

// LogDelivery appends a delivery attempt to the in-memory delivery log.
func LogDelivery(rec DeliveryRecord) {
	deliveryLog = append(deliveryLog, rec)
}

// ListDeliveryHistory returns every logged delivery attempt for
// subscriberID, across the log's entire lifetime.
//
// PLANTED VULNERABILITY (unbounded-payload, real): this walks the
// entire in-memory delivery log with no row cap, no page size, and no
// upper bound at all. A subscriber with millions of historical
// deliveries turns one call into an unbounded-size response and an
// unbounded-size allocation — exactly the "externally-influenced read
// with no explicit size/row/byte cap" pattern BLUEPRINT.md's
// Performance & Resource Bounds section exists to catch.
func ListDeliveryHistory(subscriberID string) []DeliveryRecord {
	var out []DeliveryRecord
	for _, rec := range deliveryLog {
		if rec.SubscriberID == subscriberID {
			out = append(out, rec)
		}
	}
	return out
}
