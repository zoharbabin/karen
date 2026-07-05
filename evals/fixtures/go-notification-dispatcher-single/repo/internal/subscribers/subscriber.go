package subscribers

// Notifier is implemented by every subscriber transport the dispatcher
// can deliver to. Registered subscribers are invoked through this
// interface value, never through their concrete type — see
// dispatch.Dispatcher.Send.
type Notifier interface {
	Notify(message string) error
}
