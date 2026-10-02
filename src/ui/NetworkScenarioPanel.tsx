import { SCENARIOS, scenarioStore, type ScenarioName } from '../mocks/scenarios'
import { clearStoredData, useStore } from '../storage'

function resetAllData() {
  clearStoredData()
  location.reload()
}

export function NetworkScenarioPanel() {
  const scenario = useStore(scenarioStore)

  return (
    <details className="scenario-panel">
      <summary>Mock API</summary>
      <label htmlFor="scenario">Network scenario</label>
      <select id="scenario" value={scenario} onChange={(event) => scenarioStore.set(event.target.value as ScenarioName)}>
        {Object.keys(SCENARIOS).map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <p className="hint">{SCENARIOS[scenario].description}</p>
      <button type="button" onClick={resetAllData}>
        Reset all data
      </button>
    </details>
  )
}
