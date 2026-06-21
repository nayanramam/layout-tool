import { LAYER_ORDER, SKY130_LAYERS } from '../pdk/sky130';
import { useLayoutStore } from '../store/layoutStore';

export function LayerPanel() {
  const activeLayer = useLayoutStore((s) => s.activeLayer);
  const layerVisibility = useLayoutStore((s) => s.layerVisibility);
  const setActiveLayer = useLayoutStore((s) => s.setActiveLayer);
  const toggleLayerVisibility = useLayoutStore((s) => s.toggleLayerVisibility);

  return (
    <section className="panel">
      <h3>Layers</h3>
      <ul className="layer-list">
        {LAYER_ORDER.map((layerId) => {
          const layer = SKY130_LAYERS[layerId];
          return (
            <li key={layerId} className={activeLayer === layerId ? 'active' : ''}>
              <button type="button" className="layer-swatch" style={{ background: layer.color }} aria-hidden />
              <button type="button" className="layer-name" onClick={() => setActiveLayer(layerId)}>
                {layer.name}
              </button>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility[layerId]}
                  onChange={() => toggleLayerVisibility(layerId)}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
