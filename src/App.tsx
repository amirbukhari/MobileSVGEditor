import { useEditorStore } from './store/editorStore';
import { ImportScreen } from './components/ImportScreen';
import { Editor } from './components/Editor';
import './App.css';

function App() {
  const hasDocument = useEditorStore((s) => s.hasDocument);
  return hasDocument ? <Editor /> : <ImportScreen />;
}

export default App;
