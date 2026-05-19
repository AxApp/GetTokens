package menubar

type Callbacks struct {
	OpenWindow      func()
	CheckForUpdates func()
	Quit            func()
}
