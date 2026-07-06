package main

func (a *App) NormalizeAuthFileContent(content string) (string, error) {
	return a.core.NormalizeAuthFileContent(content)
}
