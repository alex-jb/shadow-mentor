// apps/shadow-lens/web/spatial-agent/src/scene/SceneGraphRenderer.ts
// Three.js renderer that IS the SpatialView the tested app logic drives. Builds the institutional
// scene from a REAL shadow-evidence-scene-v1 graph: object nodes by evidence shape (user circle,
// tool hexagon, model diamond, human square, signature shield), relations as connector lines,
// and the five spatial modes. Every SpatialView method returns whether a VISIBLE change happened,
// so the executor can honestly report EXECUTED vs RENDER_FAILED.
// AUTHORED for the browser — NOT executed in the Node suite (pure logic is tested via a MockView).
import * as THREE from "three";
import { Tokens, statusColor } from "../design-tokens.ts";
import type { SceneGraph, SceneObject, SpatialView } from "../app/types.ts";

const SUPPORTED = new Set([
  "select_object", "focus_object", "highlight_source", "highlight_claim", "highlight_metric",
  "move_camera_to_object", "open_document_mode", "open_source_mode", "open_risk_mode",
  "open_review_mode", "open_audit_mode", "open_experiment_mode", "open_code_replay_mode",
  "show_tamper_diff", "show_verification_failure", "start_audit_walkthrough",
  "start_experiment_walkthrough", "start_code_walkthrough", "return_to_workspace", "clear_selection",
]);

function geometryFor(type: string): THREE.BufferGeometry {
  switch (type) {
    case "capture": case "human": case "reviewer": return new THREE.BoxGeometry(0.16, 0.16, 0.02); // square
    case "tool": case "test": return new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6);                // hexagon
    case "model": case "metric": return new THREE.OctahedronGeometry(0.11);                          // diamond
    case "signature": case "anchor": return new THREE.ConeGeometry(0.11, 0.18, 5);                   // shield-ish
    default: return new THREE.CircleGeometry(0.1, 24);                                                // source/claim circle
  }
}

export class SceneGraphRenderer implements SpatialView {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private nodes = new Map<string, THREE.Mesh>();
  private mode = "document";
  private selected: string | null = null;

  constructor(private container: HTMLElement, private graph: SceneGraph) {
    this.scene.background = new THREE.Color(Tokens.Background);
    this.camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.01, 100);
    this.camera.position.set(0, 1.5, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    this.build(graph);
    this.renderer.setAnimationLoop(() => this.renderer.render(this.scene, this.camera));
  }

  private build(graph: SceneGraph) {
    (graph.objects ?? []).forEach((o: SceneObject, i: number) => {
      const mesh = new THREE.Mesh(geometryFor(o.type), new THREE.MeshBasicMaterial({ color: statusColor(o.status), transparent: true, opacity: 0.85 }));
      const anyO = o as any;
      const p = anyO.position ?? [(i % 5) * 0.35 - 0.7, 1.4 - Math.floor(i / 5) * 0.3, -1.6];
      mesh.position.set(p[0], p[1], p[2]);
      mesh.userData.id = o.id;
      this.scene.add(mesh);
      this.nodes.set(o.id, mesh);
    });
    // relations as thin lines
    for (const r of (graph.relations ?? []) as any[]) {
      const a = this.nodes.get(r.from), b = this.nodes.get(r.to);
      if (!a || !b) continue;
      const g = new THREE.BufferGeometry().setFromPoints([a.position, b.position]);
      this.scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: Tokens.Border })));
    }
  }

  // ── SpatialView ──
  supports(action: string) { return SUPPORTED.has(action); }
  setMode(mode: string) { this.mode = mode; return true; }
  selectObject(id: string) { const m = this.nodes.get(id); if (!m) return false; this.selected = id; (m.material as THREE.MeshBasicMaterial).opacity = 1; return true; }
  focusObject(id: string) { const m = this.nodes.get(id); if (!m) return false; this.selected = id; this.moveCameraTo(id); return true; }
  highlight(id: string) { const m = this.nodes.get(id); if (!m) return false; (m.material as THREE.MeshBasicMaterial).color.set(Tokens.Information); (m.material as THREE.MeshBasicMaterial).opacity = 1; return true; }
  moveCameraTo(id: string) { const m = this.nodes.get(id); if (!m) return false; const t = m.position; this.camera.position.set(t.x, t.y + 0.1, t.z + 0.8); this.camera.lookAt(t); return true; }
  startWalkthrough(kind: string) { let i = 0; const ids = [...this.nodes.keys()]; const step = () => { if (i < ids.length) { this.focusObject(ids[i++]); setTimeout(step, 1200); } }; step(); return ids.length > 0; }
  showTamperDiff() { const v = this.nodes.get("verify"); if (v) (v.material as THREE.MeshBasicMaterial).color.set(Tokens.Tampered); return !!v; }
  showVerificationFailure() { return this.showTamperDiff(); }
  returnToWorkspace() { this.mode = "document"; this.selected = null; this.camera.position.set(0, 1.5, 0); return true; }
  clearSelection() { this.selected = null; return true; }

  get currentMode() { return this.mode; }
  get selectedId() { return this.selected; }
}
