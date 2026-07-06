// Command scoreformat scores dispatch.FormatJSONPayload against the
// hand-labeled gold set in internal/dispatch/testdata/format_gold.json
// and reports the percentage of cases that match the v2 spec exactly.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/example/notification-dispatcher/internal/dispatch"
)

type goldCase struct {
	SubscriberID string `json:"subscriberID"`
	Message      string `json:"message"`
	Want         string `json:"want"`
}

func main() {
	data, err := os.ReadFile("internal/dispatch/testdata/format_gold.json")
	if err != nil {
		log.Fatal(err)
	}
	var cases []goldCase
	if err := json.Unmarshal(data, &cases); err != nil {
		log.Fatal(err)
	}
	matched := 0
	for _, c := range cases {
		if dispatch.FormatJSONPayload(c.SubscriberID, c.Message) == c.Want {
			matched++
		}
	}
	fmt.Printf("%d/%d match (%.0f%%)\n", matched, len(cases), 100*float64(matched)/float64(len(cases)))
}
