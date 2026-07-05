package dispatch

// ListDeliveryHistoryPage returns at most pageSize logged delivery
// attempts for subscriberID, starting at offset.
//
// DECOY (unbounded-payload category): textually this walks the same
// deliveryLog slice as ListDeliveryHistory, but it takes an explicit
// pageSize and stops once that many matches are collected — a real
// caller-facing size cap, not an unbounded read. A scanner that flags
// every "range over deliveryLog" call site as unbounded, without
// checking whether the loop actually enforces a cap, would wrongly
// flag this alongside the genuinely unbounded ListDeliveryHistory.
func ListDeliveryHistoryPage(subscriberID string, offset, pageSize int) []DeliveryRecord {
	if pageSize <= 0 {
		pageSize = 50
	}
	var out []DeliveryRecord
	skipped := 0
	for _, rec := range deliveryLog {
		if rec.SubscriberID != subscriberID {
			continue
		}
		if skipped < offset {
			skipped++
			continue
		}
		out = append(out, rec)
		if len(out) >= pageSize {
			break
		}
	}
	return out
}
