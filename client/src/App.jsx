import { useState, useEffect } from 'react'
import Editor from './components/Editor'
import DocumentList from './components/DocumentList'
import Header from './components/Header'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [documents, setDocuments] = useState([])
  const [currentDocId, setCurrentDocId] = useState(null)
  const [showDocList, setShowDocList] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchDocuments()
    checkUser()
  }, [])

  const checkUser = async () => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const handleCreateDocument = async () => {
    try {
      const newDoc = {
        title: 'Untitled Document',
        content: '# New Document\n\nStart typing here...',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('documents')
        .insert([newDoc])
        .select()

      if (error) throw error
      if (data && data[0]) {
        setDocuments([data[0], ...documents])
        setCurrentDocId(data[0].id)
        setShowDocList(false)
      }
    } catch (error) {
      console.error('Error creating document:', error)
    }
  }

  const handleOpenDocument = (docId) => {
    setCurrentDocId(docId)
    setShowDocList(false)
  }

  const handleBackToList = () => {
    setShowDocList(true)
    setCurrentDocId(null)
    fetchDocuments()
  }

  const handleSetUser = (userName) => {
    const userData = { name: userName, color: generateRandomColor() }
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const generateRandomColor = () => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  return (
    <div className="app">
      <Header 
        user={user} 
        onSetUser={handleSetUser}
        onBackToList={!showDocList ? handleBackToList : null}
      />
      
      {showDocList ? (
        <DocumentList
          documents={documents}
          onCreateDocument={handleCreateDocument}
          onOpenDocument={handleOpenDocument}
        />
      ) : (
        <Editor
          documentId={currentDocId}
          user={user}
          onUpdateTitle={fetchDocuments}
        />
      )}
    </div>
  )
}

export default App
