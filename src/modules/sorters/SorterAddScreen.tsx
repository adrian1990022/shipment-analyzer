import { SorterForm } from "./SorterForm";

export function SorterAddScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  return (
    <div className="screen">
      <button className="back" onClick={onBack}>
        ← Sortujący
      </button>
      <h1>Sortujący</h1>
      <SorterForm onDone={onDone} onCancel={onBack} />
    </div>
  );
}
