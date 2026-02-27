import { useState, useEffect } from 'react'
import Editor from './components/Editor'
import DocumentList from './components/DocumentList'
import SharedWithMe from './components/SharedWithMe'
import Contacts from './components/Contacts'
import Header from './components/Header'
import { api } from './lib/api'
import './App.css'

function App() {
  const [documents, setDocuments] = useState([])
  const [currentDocId, setCurrentDocId] = useState(null)
  const [activeTab, setActiveTab] = useState('my-docs') // 'my-docs' | 'shared' | 'contacts'
  const [showEditor, setShowEditor] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) fetchDocuments()
  }, [user, activeTab])

  const checkUser = () => {
    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))
  }

  const fetchDocuments = async () => {
    try {
      const data = await api.getDocuments(user?.name)
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const handleCreateDocument = async () => {
    try {
      const data = await api.createDocument(
        'Untitled Document',
        '# New Document\n\nStart typing here...',
        user?.name
      )
      if (data) {
        setCurrentDocId(data.id)
        setShowEditor(true)
      }
    } catch (error) {
      console.error('Error creating document:', error)
    }
  }

  const handleOpenDocument = (docId) => {
    setCurrentDocId(docId)
    setShowEditor(true)
  }

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) return
    try {
      await api.deleteDocument(docId)
      setDocuments(documents.filter(d => d.id !== docId))
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const handleBackToList = () => {
    setShowEditor(false)
    setCurrentDocId(null)
    fetchDocuments()
  }

  const handleSetUser = async (userName) => {
    const userData = { name: userName, color: generateRandomColor() }
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    try {
      await api.registerUser(userName, userData.color)
    } catch (e) {
      // ignore if user already exists
    }
  }

  const generateRandomColor = () => {
    const colors = ['#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#a142f4', '#e37400']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const renderContent = () => {
    if (showEditor) {
      return (
        <Editor
          documentId={currentDocId}
          user={user}
          onUpdateTitle={fetchDocuments}
        />
      )
    }

    switch (activeTab) {
      case 'shared':
        return <SharedWithMe user={user} onOpenDocument={handleOpenDocument} />
      case 'contacts':
        return <Contacts user={user} onOpenDocument={handleOpenDocument} />
      default:
        return (
          <DocumentList
            documents={documents}
            user={user}
            onCreateDocument={handleCreateDocument}
            onOpenDocument={handleOpenDocument}
            onDeleteDocument={handleDeleteDocument}
            onRefresh={fetchDocuments}
          />
        )
    }
  }

  return (
    <div className="app">
      <Header
        user={user}
        onSetUser={handleSetUser}
        onBackToList={showEditor ? handleBackToList : null}
        activeTab={activeTab}
        onTabChange={showEditor ? null : setActiveTab}
      />
      {renderContent()}
    </div>
  )
}

export default App
