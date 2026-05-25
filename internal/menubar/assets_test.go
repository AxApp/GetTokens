package menubar

import "testing"

func TestMenuBarIconPNGEmbedded(t *testing.T) {
	if len(menuBarIconPNG) == 0 {
		t.Fatal("menuBarIconPNG is empty")
	}
}
