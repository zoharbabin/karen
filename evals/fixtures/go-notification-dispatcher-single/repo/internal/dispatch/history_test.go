package dispatch

import "testing"

func TestListDeliveryHistoryPageRespectsPageSize(t *testing.T) {
	deliveryLog = nil
	for i := 0; i < 5; i++ {
		LogDelivery(DeliveryRecord{SubscriberID: "sub1", Message: "m", StatusCode: 200})
	}

	page := ListDeliveryHistoryPage("sub1", 0, 2)
	if len(page) != 2 {
		t.Fatalf("expected page size 2, got %d", len(page))
	}
}

func TestListDeliveryHistoryReturnsAllMatchingRecords(t *testing.T) {
	deliveryLog = nil
	LogDelivery(DeliveryRecord{SubscriberID: "sub1", Message: "a", StatusCode: 200})
	LogDelivery(DeliveryRecord{SubscriberID: "sub2", Message: "b", StatusCode: 200})

	all := ListDeliveryHistory("sub1")
	if len(all) != 1 {
		t.Fatalf("expected 1 record for sub1, got %d", len(all))
	}
}
