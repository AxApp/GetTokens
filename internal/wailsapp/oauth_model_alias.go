package wailsapp

import (
	"errors"
	"strings"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

type UpdateOAuthModelAliasesInput struct {
	Channel string                  `json:"channel"`
	Models  []OpenAICompatibleModel `json:"models,omitempty"`
}

func (a *App) ListOAuthModelAliases(channel string) ([]OpenAICompatibleModel, error) {
	channel = normalizeOAuthModelAliasChannel(channel)
	if channel == "" {
		return nil, errors.New("channel 不能为空")
	}

	items, err := a.managementClient().ListOAuthModelAliases()
	if err != nil {
		return nil, err
	}

	aliases := items[channel]
	out := make([]OpenAICompatibleModel, 0, len(aliases))
	for _, item := range aliases {
		name := strings.TrimSpace(item.Name)
		alias := strings.TrimSpace(item.Alias)
		if name == "" || alias == "" {
			continue
		}
		out = append(out, OpenAICompatibleModel{
			Name:  name,
			Alias: alias,
		})
	}
	return out, nil
}

func (a *App) UpdateOAuthModelAliases(input UpdateOAuthModelAliasesInput) error {
	channel := normalizeOAuthModelAliasChannel(input.Channel)
	if channel == "" {
		return errors.New("channel 不能为空")
	}

	current, err := a.managementClient().ListOAuthModelAliases()
	if err != nil {
		return err
	}
	if current == nil {
		current = map[string][]cliproxyapi.OAuthModelAlias{}
	}

	aliases := normalizeOAuthModelAliases(input.Models)
	if len(aliases) == 0 {
		delete(current, channel)
	} else {
		current[channel] = aliases
	}
	return a.managementClient().PutOAuthModelAliases(current)
}

func normalizeOAuthModelAliasChannel(channel string) string {
	return strings.ToLower(strings.TrimSpace(channel))
}

func normalizeOAuthModelAliases(models []OpenAICompatibleModel) []cliproxyapi.OAuthModelAlias {
	out := make([]cliproxyapi.OAuthModelAlias, 0, len(models))
	seenAlias := make(map[string]struct{}, len(models))
	for _, model := range models {
		name := strings.TrimSpace(model.Name)
		alias := strings.TrimSpace(model.Alias)
		if name == "" || alias == "" || strings.EqualFold(name, alias) {
			continue
		}
		aliasKey := strings.ToLower(alias)
		if _, ok := seenAlias[aliasKey]; ok {
			continue
		}
		seenAlias[aliasKey] = struct{}{}
		out = append(out, cliproxyapi.OAuthModelAlias{
			Name:  name,
			Alias: alias,
		})
	}
	return out
}
