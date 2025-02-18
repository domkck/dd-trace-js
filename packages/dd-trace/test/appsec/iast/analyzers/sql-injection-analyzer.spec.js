'use strict'

const proxyquire = require('proxyquire')

describe('sql-injection-analyzer', () => {
  const NOT_TAINTED_QUERY = 'no vulnerable query'
  const TAINTED_QUERY = 'vulnerable query'

  const TaintTrackingMock = {
    isTainted: (iastContext, string) => {
      return string === TAINTED_QUERY
    }
  }

  const InjectionAnalyzer = proxyquire('../../../../src/appsec/iast/analyzers/injection-analyzer', {
    '../taint-tracking/operations': TaintTrackingMock
  })
  const sqlInjectionAnalyzer = proxyquire('../../../../src/appsec/iast/analyzers/sql-injection-analyzer', {
    './injection-analyzer': InjectionAnalyzer
  })

  it('should subscribe to mysql, mysql2 and pg start query channel', () => {
    expect(sqlInjectionAnalyzer._subscriptions).to.have.lengthOf(5)
    expect(sqlInjectionAnalyzer._subscriptions[0]._channel.name).to.equals('apm:mysql:query:start')
    expect(sqlInjectionAnalyzer._subscriptions[1]._channel.name).to.equals('apm:mysql2:query:start')
    expect(sqlInjectionAnalyzer._subscriptions[2]._channel.name).to.equals('apm:pg:query:start')
    expect(sqlInjectionAnalyzer._subscriptions[3]._channel.name).to.equals('datadog:sequelize:query:start')
    expect(sqlInjectionAnalyzer._subscriptions[4]._channel.name).to.equals('datadog:sequelize:query:finish')
  })

  it('should not detect vulnerability when no query', () => {
    const isVulnerable = sqlInjectionAnalyzer._isVulnerable()
    expect(isVulnerable).to.be.false
  })

  it('should not detect vulnerability when no vulnerable query', () => {
    const isVulnerable = sqlInjectionAnalyzer._isVulnerable(NOT_TAINTED_QUERY)
    expect(isVulnerable).to.be.false
  })

  it('should detect vulnerability when vulnerable query', () => {
    const isVulnerable = sqlInjectionAnalyzer._isVulnerable(TAINTED_QUERY)
    expect(isVulnerable).to.be.true
  })

  it('should report "SQL_INJECTION" vulnerability', () => {
    const dialect = 'DIALECT'
    const addVulnerability = sinon.stub()
    const iastContext = {
      rootSpan: {
        context () {
          return {
            toSpanId () {
              return '123'
            }
          }
        }
      }
    }
    const ProxyAnalyzer = proxyquire('../../../../src/appsec/iast/analyzers/vulnerability-analyzer', {
      '../iast-context': {
        getIastContext: () => iastContext
      },
      '../overhead-controller': { hasQuota: () => true }
    })
    const InjectionAnalyzer = proxyquire('../../../../src/appsec/iast/analyzers/injection-analyzer', {
      '../taint-tracking/operations': TaintTrackingMock,
      './vulnerability-analyzer': ProxyAnalyzer
    })
    const proxiedSqlInjectionAnalyzer = proxyquire('../../../../src/appsec/iast/analyzers/sql-injection-analyzer',
      {
        './injection-analyzer': InjectionAnalyzer,
        '../taint-tracking/operations': TaintTrackingMock,
        '../iast-context': {
          getIastContext: () => iastContext
        },
        '../vulnerability-reporter': { addVulnerability }
      })
    proxiedSqlInjectionAnalyzer.analyze(TAINTED_QUERY, dialect)
    expect(addVulnerability).to.have.been.calledOnce
    expect(addVulnerability).to.have.been.calledWithMatch({}, {
      type: 'SQL_INJECTION',
      evidence: { dialect: dialect }
    })
  })
})
