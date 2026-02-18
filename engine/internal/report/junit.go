package report

import (
	"encoding/xml"
	"fmt"
	"strconv"

	"github.com/attest-ai/attest/engine/pkg/types"
)

type JUnitTestSuites struct {
	XMLName xml.Name         `xml:"testsuites"`
	Suites  []JUnitTestSuite `xml:"testsuite"`
}

type JUnitTestSuite struct {
	Name     string          `xml:"name,attr"`
	Tests    int             `xml:"tests,attr"`
	Failures int             `xml:"failures,attr"`
	Errors   int             `xml:"errors,attr"`
	Time     string          `xml:"time,attr"`
	Cases    []JUnitTestCase `xml:"testcase"`
}

type JUnitTestCase struct {
	Name      string        `xml:"name,attr"`
	ClassName string        `xml:"classname,attr"`
	Time      string        `xml:"time,attr"`
	Failure   *JUnitFailure `xml:"failure,omitempty"`
	SystemOut string        `xml:"system-out,omitempty"`
}

type JUnitFailure struct {
	Message string `xml:"message,attr"`
	Type    string `xml:"type,attr,omitempty"`
	Content string `xml:",chardata"`
}

// GenerateJUnitXML generates a JUnit XML report from assertion results.
func GenerateJUnitXML(results []types.AssertionResult, totalDurationMS int64) ([]byte, error) {
	var failures int
	var cases []JUnitTestCase

	for _, result := range results {
		testCase := JUnitTestCase{
			Name:      result.AssertionID,
			ClassName: getAssertionType(result.AssertionID),
			Time:      formatDuration(result.DurationMS),
		}

		if result.Status == types.StatusHardFail || result.Status == types.StatusSoftFail {
			failures++
			failureType := ""
			if result.Status == types.StatusSoftFail {
				failureType = "soft_fail"
			}
			testCase.Failure = &JUnitFailure{
				Message: result.Explanation,
				Type:    failureType,
				Content: result.Status,
			}
		} else if result.Status == types.StatusPass {
			testCase.SystemOut = result.Explanation
		}

		cases = append(cases, testCase)
	}

	suite := JUnitTestSuite{
		Name:     "attest",
		Tests:    len(results),
		Failures: failures,
		Errors:   0,
		Time:     formatDuration(totalDurationMS),
		Cases:    cases,
	}

	suites := JUnitTestSuites{
		Suites: []JUnitTestSuite{suite},
	}

	output, err := xml.MarshalIndent(suites, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal XML: %w", err)
	}

	// Add XML declaration
	xmlWithDecl := append([]byte(xml.Header), output...)
	return xmlWithDecl, nil
}

// getAssertionType extracts the assertion type from the assertion ID.
// Falls back to parsing assertion description or returns "unknown".
func getAssertionType(assertionID string) string {
	// Parse assertion ID format: "assert_NNN" or similar
	// For now, return a generic classname based on ID pattern
	// In practice, you'd want to pass type information through results
	return "assertion"
}

// formatDuration converts milliseconds to seconds as a string for XML.
func formatDuration(ms int64) string {
	seconds := float64(ms) / 1000.0
	return strconv.FormatFloat(seconds, 'f', 3, 64)
}
