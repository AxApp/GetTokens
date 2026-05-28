package wailsapp

import (
	"errors"
	"math"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/yanyiwu/gojieba"
)

type AnalyzeCodexSessionsInput struct {
	Scope      string   `json:"scope"`
	ProjectID  string   `json:"projectID,omitempty"`
	SessionIDs []string `json:"sessionIDs,omitempty"`
	Limit      int      `json:"limit,omitempty"`
}

type SessionAnalysisResult struct {
	Scope                 string                            `json:"scope"`
	GeneratedAt           string                            `json:"generatedAt"`
	RequestedSessionCount int                               `json:"requestedSessionCount"`
	AnalyzedSessionCount  int                               `json:"analyzedSessionCount"`
	SkippedSessionCount   int                               `json:"skippedSessionCount"`
	TotalMessages         int                               `json:"totalMessages"`
	TotalTerms            int                               `json:"totalTerms"`
	Keywords              []SessionAnalysisKeyword          `json:"keywords"`
	RoleContributions     []SessionAnalysisRoleContribution `json:"roleContributions"`
	Projects              []SessionAnalysisProjectSummary   `json:"projects"`
	Sessions              []SessionAnalysisSessionSummary   `json:"sessions"`
}

type SessionAnalysisKeyword struct {
	Term         string  `json:"term"`
	Count        int     `json:"count"`
	SessionCount int     `json:"sessionCount"`
	Score        float64 `json:"score"`
}

type SessionAnalysisRoleContribution struct {
	Role         string  `json:"role"`
	MessageCount int     `json:"messageCount"`
	TermCount    int     `json:"termCount"`
	Share        float64 `json:"share"`
}

type SessionAnalysisProjectSummary struct {
	ProjectID    string                   `json:"projectID"`
	ProjectName  string                   `json:"projectName"`
	SessionCount int                      `json:"sessionCount"`
	MessageCount int                      `json:"messageCount"`
	TermCount    int                      `json:"termCount"`
	Keywords     []SessionAnalysisKeyword `json:"keywords"`
}

type SessionAnalysisSessionSummary struct {
	SessionID         string                            `json:"sessionID"`
	ProjectID         string                            `json:"projectID"`
	ProjectName       string                            `json:"projectName"`
	Title             string                            `json:"title"`
	Status            string                            `json:"status"`
	Provider          string                            `json:"provider"`
	Model             string                            `json:"model,omitempty"`
	MessageCount      int                               `json:"messageCount"`
	TermCount         int                               `json:"termCount"`
	TopicLine         string                            `json:"topicLine"`
	Keywords          []SessionAnalysisKeyword          `json:"keywords"`
	RoleContributions []SessionAnalysisRoleContribution `json:"roleContributions"`
}

type sessionAnalysisAccumulator struct {
	termCounts       map[string]int
	termSessions     map[string]map[string]struct{}
	roleMessages     map[string]int
	roleTerms        map[string]int
	sessionCount     int
	messageCount     int
	termCount        int
	sessionSummaries []SessionAnalysisSessionSummary
}

func (a *App) AnalyzeCodexSessions(input AnalyzeCodexSessionsInput) (*SessionAnalysisResult, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	threadNames, err := loadSessionThreadNames(codexHome)
	if err != nil {
		return nil, err
	}

	targets, err := resolveCodexSessionAnalysisTargets(codexHome, input)
	if err != nil {
		return nil, err
	}

	segmenter := gojieba.NewJieba()
	defer segmenter.Free()

	global := newSessionAnalysisAccumulator()
	projects := map[string]*sessionAnalysisAccumulator{}
	skipped := 0
	limit := input.Limit
	if limit < 0 {
		limit = 0
	}

	for _, absolutePath := range targets {
		if limit > 0 && global.sessionCount >= limit {
			skipped++
			continue
		}
		relativePath, err := filepath.Rel(codexHome, absolutePath)
		if err != nil {
			return nil, err
		}
		relativePath = filepath.ToSlash(relativePath)
		result, err := parseSessionFile(codexHome, absolutePath, relativePath, threadNames, true)
		if err != nil {
			return nil, err
		}
		projectID := strings.TrimSpace(result.detail.ProjectID)
		if projectID == "" {
			projectID = "unknown"
			result.detail.ProjectID = projectID
		}
		if input.ProjectID != "" && projectID != input.ProjectID {
			skipped++
			continue
		}

		summary := analyzeSessionDetail(result.detail, segmenter)
		if summary.MessageCount == 0 || summary.TermCount == 0 {
			skipped++
			continue
		}
		global.addSession(summary)
		project := projects[projectID]
		if project == nil {
			project = newSessionAnalysisAccumulator()
			projects[projectID] = project
		}
		project.addSession(summary)
	}

	projectSummaries := make([]SessionAnalysisProjectSummary, 0, len(projects))
	for projectID, accumulator := range projects {
		projectName := projectID
		if len(accumulator.sessionSummaries) > 0 {
			projectName = accumulator.sessionSummaries[0].ProjectName
		}
		projectSummaries = append(projectSummaries, SessionAnalysisProjectSummary{
			ProjectID:    projectID,
			ProjectName:  projectName,
			SessionCount: accumulator.sessionCount,
			MessageCount: accumulator.messageCount,
			TermCount:    accumulator.termCount,
			Keywords:     accumulator.topKeywords(8),
		})
	}
	sort.Slice(projectSummaries, func(i, j int) bool {
		if projectSummaries[i].SessionCount == projectSummaries[j].SessionCount {
			return projectSummaries[i].ProjectName < projectSummaries[j].ProjectName
		}
		return projectSummaries[i].SessionCount > projectSummaries[j].SessionCount
	})

	scope := strings.TrimSpace(input.Scope)
	if scope == "" {
		if len(input.SessionIDs) > 0 {
			scope = "selected"
		} else {
			scope = "all"
		}
	}

	return &SessionAnalysisResult{
		Scope:                 scope,
		GeneratedAt:           formatSessionManagementTimestamp(nowForSessionAnalysis()),
		RequestedSessionCount: len(targets),
		AnalyzedSessionCount:  global.sessionCount,
		SkippedSessionCount:   skipped,
		TotalMessages:         global.messageCount,
		TotalTerms:            global.termCount,
		Keywords:              global.topKeywords(20),
		RoleContributions:     global.roleContributions(),
		Projects:              projectSummaries,
		Sessions:              global.sessionSummaries,
	}, nil
}

func resolveCodexSessionAnalysisTargets(codexHome string, input AnalyzeCodexSessionsInput) ([]string, error) {
	if len(input.SessionIDs) > 0 || input.Scope == "selected" {
		if len(input.SessionIDs) == 0 {
			return nil, errors.New("缺少待分析的 session ids")
		}
		paths := make([]string, 0, len(input.SessionIDs))
		seen := map[string]struct{}{}
		for _, sessionID := range input.SessionIDs {
			absolutePath, err := resolveSessionAbsolutePath(codexHome, sessionID)
			if err != nil {
				return nil, err
			}
			if _, ok := seen[absolutePath]; ok {
				continue
			}
			seen[absolutePath] = struct{}{}
			paths = append(paths, absolutePath)
		}
		return paths, nil
	}
	return listCodexRolloutPaths(codexHome)
}

func nowForSessionAnalysis() time.Time {
	return time.Now()
}

func newSessionAnalysisAccumulator() *sessionAnalysisAccumulator {
	return &sessionAnalysisAccumulator{
		termCounts:       map[string]int{},
		termSessions:     map[string]map[string]struct{}{},
		roleMessages:     map[string]int{},
		roleTerms:        map[string]int{},
		sessionSummaries: []SessionAnalysisSessionSummary{},
	}
}

func (accumulator *sessionAnalysisAccumulator) addSession(summary SessionAnalysisSessionSummary) {
	accumulator.sessionCount++
	accumulator.messageCount += summary.MessageCount
	accumulator.termCount += summary.TermCount
	accumulator.sessionSummaries = append(accumulator.sessionSummaries, summary)
	for _, keyword := range summary.Keywords {
		accumulator.termCounts[keyword.Term] += keyword.Count
		sessions := accumulator.termSessions[keyword.Term]
		if sessions == nil {
			sessions = map[string]struct{}{}
			accumulator.termSessions[keyword.Term] = sessions
		}
		sessions[summary.SessionID] = struct{}{}
	}
	for _, contribution := range summary.RoleContributions {
		accumulator.roleMessages[contribution.Role] += contribution.MessageCount
		accumulator.roleTerms[contribution.Role] += contribution.TermCount
	}
}

func (accumulator *sessionAnalysisAccumulator) topKeywords(limit int) []SessionAnalysisKeyword {
	items := make([]SessionAnalysisKeyword, 0, len(accumulator.termCounts))
	for term, count := range accumulator.termCounts {
		sessionCount := len(accumulator.termSessions[term])
		items = append(items, SessionAnalysisKeyword{
			Term:         term,
			Count:        count,
			SessionCount: sessionCount,
			Score:        roundAnalysisShare(float64(count) * (1 + math.Log1p(float64(sessionCount)))),
		})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Count == items[j].Count {
			if items[i].SessionCount == items[j].SessionCount {
				return items[i].Term < items[j].Term
			}
			return items[i].SessionCount > items[j].SessionCount
		}
		return items[i].Count > items[j].Count
	})
	if limit > 0 && len(items) > limit {
		return items[:limit]
	}
	return items
}

func (accumulator *sessionAnalysisAccumulator) roleContributions() []SessionAnalysisRoleContribution {
	items := make([]SessionAnalysisRoleContribution, 0, len(accumulator.roleMessages))
	for role, messageCount := range accumulator.roleMessages {
		termCount := accumulator.roleTerms[role]
		items = append(items, SessionAnalysisRoleContribution{
			Role:         role,
			MessageCount: messageCount,
			TermCount:    termCount,
			Share:        roundAnalysisShare(safeAnalysisShare(termCount, accumulator.termCount)),
		})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].TermCount == items[j].TermCount {
			if items[i].MessageCount == items[j].MessageCount {
				return items[i].Role < items[j].Role
			}
			return items[i].MessageCount > items[j].MessageCount
		}
		return items[i].TermCount > items[j].TermCount
	})
	return items
}

func analyzeSessionDetail(detail SessionManagementSessionDetail, segmenter *gojieba.Jieba) SessionAnalysisSessionSummary {
	termCounts := map[string]int{}
	roleMessages := map[string]int{}
	roleTerms := map[string]int{}
	totalMessages := 0
	totalTerms := 0

	for _, message := range detail.Messages {
		if !isAnalyzableSessionRole(message.Role) {
			continue
		}
		text := strings.TrimSpace(strings.Join([]string{message.Title, message.Summary, message.Content}, " "))
		if text == "" {
			continue
		}
		terms := segmentSessionAnalysisText(segmenter, text)
		if len(terms) == 0 {
			continue
		}
		totalMessages++
		roleMessages[message.Role]++
		roleTerms[message.Role] += len(terms)
		totalTerms += len(terms)
		for _, term := range terms {
			termCounts[term]++
		}
	}

	sessionAccumulator := newSessionAnalysisAccumulator()
	sessionAccumulator.termCounts = termCounts
	sessionAccumulator.termSessions = map[string]map[string]struct{}{}
	for term := range termCounts {
		sessionAccumulator.termSessions[term] = map[string]struct{}{detail.SessionID: struct{}{}}
	}
	sessionAccumulator.roleMessages = roleMessages
	sessionAccumulator.roleTerms = roleTerms
	sessionAccumulator.termCount = totalTerms
	keywords := sessionAccumulator.topKeywords(10)

	topicTerms := make([]string, 0, 5)
	for _, keyword := range keywords {
		topicTerms = append(topicTerms, keyword.Term)
		if len(topicTerms) >= 5 {
			break
		}
	}
	topicLine := "—"
	if len(topicTerms) > 0 {
		topicLine = strings.Join(topicTerms, " / ")
	}

	return SessionAnalysisSessionSummary{
		SessionID:         detail.SessionID,
		ProjectID:         detail.ProjectID,
		ProjectName:       detail.ProjectName,
		Title:             detail.Title,
		Status:            detail.Status,
		Provider:          detail.Provider,
		Model:             detail.Model,
		MessageCount:      totalMessages,
		TermCount:         totalTerms,
		TopicLine:         topicLine,
		Keywords:          keywords,
		RoleContributions: sessionAccumulator.roleContributions(),
	}
}

func isAnalyzableSessionRole(role string) bool {
	return role == "user" || role == "assistant" || role == "reasoning" || role == "tool_call" || role == "tool_result"
}

func segmentSessionAnalysisText(segmenter *gojieba.Jieba, text string) []string {
	rawTerms := segmenter.CutForSearch(text, true)
	terms := make([]string, 0, len(rawTerms))
	for _, raw := range rawTerms {
		term := normalizeSessionAnalysisTerm(raw)
		if shouldKeepSessionAnalysisTerm(term) {
			terms = append(terms, term)
		}
	}
	return terms
}

func normalizeSessionAnalysisTerm(term string) string {
	return strings.ToLower(strings.TrimSpace(term))
}

func shouldKeepSessionAnalysisTerm(term string) bool {
	if term == "" || sessionAnalysisStopWords[term] {
		return false
	}
	if utf8.RuneCountInString(term) <= 1 {
		return false
	}
	hasLetterOrHan := false
	hasDigit := false
	for _, r := range term {
		switch {
		case unicode.Is(unicode.Han, r), unicode.IsLetter(r):
			hasLetterOrHan = true
		case unicode.IsDigit(r):
			hasDigit = true
		case r == '-' || r == '_' || r == '.':
			continue
		default:
			return false
		}
	}
	return hasLetterOrHan && !(!hasLetterOrHan && hasDigit)
}

func safeAnalysisShare(value int, total int) float64 {
	if total <= 0 {
		return 0
	}
	return float64(value) / float64(total)
}

func roundAnalysisShare(value float64) float64 {
	return math.Round(value*100) / 100
}

var sessionAnalysisStopWords = map[string]bool{
	"一个":    true,
	"一些":    true,
	"不是":    true,
	"不会":    true,
	"不应":    true,
	"以及":    true,
	"但是":    true,
	"已经":    true,
	"我们":    true,
	"这个":    true,
	"那个":    true,
	"需要":    true,
	"应该":    true,
	"可以":    true,
	"进行":    true,
	"通过":    true,
	"如果":    true,
	"因为":    true,
	"所以":    true,
	"然后":    true,
	"当前":    true,
	"页面":    true,
	"the":   true,
	"and":   true,
	"for":   true,
	"with":  true,
	"from":  true,
	"this":  true,
	"that":  true,
	"into":  true,
	"true":  true,
	"false": true,
}
