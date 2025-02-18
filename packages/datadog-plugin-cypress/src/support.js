/* eslint-disable */
beforeEach(() => {
  cy.task('dd:beforeEach', {
    testName: Cypress.mocha.getRunner().suite.ctx.currentTest.fullTitle(),
    testSuite: Cypress.mocha.getRootSuite().file
  }).then(traceId => {
    Cypress.env('traceId', traceId)
  })
})

before(() => {
  cy.task('dd:testSuiteStart', Cypress.mocha.getRootSuite().file)
})

after(() => {
  cy.task('dd:testSuiteFinish', Cypress.mocha.getRunner().stats)
  cy.window().then(win => {
    win.dispatchEvent(new Event('beforeunload'))
  })
})


afterEach(() => {
  cy.window().then(win => {
    const currentTest = Cypress.mocha.getRunner().suite.ctx.currentTest
    const testInfo = {
      testName: currentTest.fullTitle(),
      testSuite: Cypress.mocha.getRootSuite().file,
      state: currentTest.state,
      error: currentTest.err,
    }
    try {
      testInfo.testSourceLine = Cypress.mocha.getRunner().currentRunnable.invocationDetails.line
    } catch (e) {}

    if (win.DD_RUM) {
      testInfo.isRUMActive = true
    }
    cy.task('dd:afterEach', { test: testInfo, coverage: win.__coverage__ })
  })
})
