import './DocumentList.css'

function DocumentList({ documents, onCreateDocument, onOpenDocument }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="document-list-container">
      <div className="document-list">
        <div className="list-header">
          <h2>Your Documents</h2>
          <button onClick={onCreateDocument} className="create-button">
            + New Document
          </button>
        </div>

        <div className="documents-grid">
          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>No documents yet</h3>
              <p>Create your first collaborative markdown document</p>
              <button onClick={onCreateDocument} className="create-button-large">
                Create Document
              </button>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="document-card"
                onClick={() => onOpenDocument(doc.id)}
              >
                <div className="document-icon">📝</div>
                <h3>{doc.title}</h3>
                <p className="document-preview">
                  {doc.content?.substring(0, 100) || 'Empty document'}
                </p>
                <div className="document-meta">
                  <span>Updated {formatDate(doc.updated_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default DocumentList
