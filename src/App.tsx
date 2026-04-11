import { TitleBar } from "@/components/title-bar";
import { Chat } from "@/components/chat/chat";

function App() {
  return (
    <div
      id="app-container"
      className="flex h-screen w-screen flex-col bg-background"
    >
      <TitleBar />
      <Chat />
    </div>
  );
}

export default App;
