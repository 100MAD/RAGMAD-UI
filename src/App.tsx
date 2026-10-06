import { Navigate, Route, Routes } from 'react-router-dom'
import ChatPage from './ChatPage.tsx'
import EvaluationPage from './EvaluationPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/chats/:chatId" element={<ChatPage />} />
      <Route path="/evaluation" element={<EvaluationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
