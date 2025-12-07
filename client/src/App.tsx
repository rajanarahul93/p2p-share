import { SignalingProvider } from "@/lib/signaling";
import { FileShareApp } from "@/components/FileShareApp";

const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || "ws://localhost:8080";

function App() {
  return (
    <SignalingProvider serverUrl={SIGNALING_URL}>
      <FileShareApp />
    </SignalingProvider>
  );
}

export default App;
