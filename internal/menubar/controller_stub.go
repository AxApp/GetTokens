//go:build !darwin

package menubar

type Controller struct{}

func NewController() *Controller {
	return &Controller{}
}

func (c *Controller) Start(callbacks Callbacks) error {
	return nil
}

func (c *Controller) Stop() {}

func (c *Controller) SetStatus(status string) {}
