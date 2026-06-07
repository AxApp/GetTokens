package menubar

type Callbacks struct {
	DisplayName     string
	OpenWindow      func()
	RefreshSnapshot func()
	Quit            func()
}
