import React, { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  CheckSquare,
  Download,
  FileImage,
  FolderOpen,
  Image as ImageIcon,
  Link,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Square,
  Target,
  Trash2,
  X
} from 'lucide-react'
import { useDevMode } from '../context/DevModeContext'
import { useLanguage } from '../context/LanguageContext'

export interface MilestoneTask {
  id: string
  text: string
  done: boolean
}

export interface Milestone {
  id: string
  title: string
  description: string
  imageFile: string | null
  tasks: MilestoneTask[]
  createdAt: string
  completionDate?: string
}

type ImageSource = 'file' | 'url'

const MOCK_MILESTONES: Milestone[] = [
  {
    id: 'milestone_mock_1',
    title: 'Preparar gear para Dehkia',
    description: 'Checklist de upgrades antes de migrar a rotina de farm.',
    imageFile: null,
    createdAt: new Date().toISOString(),
    completionDate: '',
    tasks: [
      { id: 'task_mock_1', text: 'Caphras na arma principal', done: true },
      { id: 'task_mock_2', text: 'Comprar cristais reserva', done: false },
      { id: 'task_mock_3', text: 'Testar rotação por 1 hora', done: false }
    ]
  },
  {
    id: 'milestone_mock_2',
    title: 'Primeiro tesouro',
    description: 'Juntar as partes e registrar o progresso com calma.',
    imageFile: null,
    createdAt: new Date().toISOString(),
    tasks: [
      { id: 'task_mock_4', text: 'Escolher spot inicial', done: true },
      { id: 'task_mock_5', text: 'Separar buffs', done: true }
    ]
  }
]

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function formatDate(value: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString()
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function toDateInputValue(value?: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function MilestonesPage(): React.ReactElement {
  const { devMode } = useDevMode()
  const { t } = useLanguage()

  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageSource, setImageSource] = useState<ImageSource>('file')
  const [completionDate, setCompletionDate] = useState('')
  const [tasks, setTasks] = useState<MilestoneTask[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloadingUrl, setDownloadingUrl] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
      if (devMode) {
        setMilestones(MOCK_MILESTONES)
        setImageCache({})
        setLoaded(true)
        return
      }

      const data = await window.api.readJson('milestones.json') as Milestone[] | null
      const list = Array.isArray(data) ? data : []
      setMilestones(list)

      const cache: Record<string, string> = {}
      for (const milestone of list) {
        if (milestone.imageFile && !cache[milestone.imageFile]) {
          const url = await window.api.getImageDataUrl(milestone.imageFile)
          if (url) cache[milestone.imageFile] = url
        }
      }
      setImageCache(cache)
      setLoaded(true)
    }
    load()
  }, [devMode])

  async function persistMilestones(list: Milestone[]): Promise<void> {
    if (!devMode) await window.api.writeJson('milestones.json', list)
    setMilestones(list)
  }

  function resetForm(): void {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setImageFile(null)
    setImageDataUrl(null)
    setImageUrl('')
    setImageSource('file')
    setCompletionDate('')
    setTasks([])
    setNewTaskText('')
    setError(null)
  }

  function scrollToForm(): void {
    const area = document.querySelector('.content-area')
    if (area) area.scrollTop = 0
  }

  async function handlePickImage(): Promise<void> {
    setError(null)
    try {
      const filename = await window.api.pickImage()
      if (!filename) return
      const url = await window.api.getImageDataUrl(filename)
      setImageFile(filename)
      setImageDataUrl(url)
      if (filename && url) setImageCache(prev => ({ ...prev, [filename]: url }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('milestones.imageError'))
    }
  }

  async function handleDownloadUrl(): Promise<void> {
    const trimmedUrl = imageUrl.trim()
    if (!trimmedUrl) return
    setError(null)
    setDownloadingUrl(true)
    try {
      const filename = await window.api.downloadImageFromUrl(trimmedUrl)
      if (!filename) return
      const url = await window.api.getImageDataUrl(filename)
      setImageFile(filename)
      setImageDataUrl(url)
      if (filename && url) setImageCache(prev => ({ ...prev, [filename]: url }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('milestones.urlError'))
    } finally {
      setDownloadingUrl(false)
    }
  }

  function handleRemoveImage(): void {
    setImageFile(null)
    setImageDataUrl(null)
  }

  function handleAddTask(): void {
    const text = newTaskText.trim()
    if (!text) return
    setTasks(prev => [...prev, { id: createId('task'), text, done: false }])
    setNewTaskText('')
  }

  function handleTaskTextChange(id: string, text: string): void {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, text } : task))
  }

  function handleTaskDoneChange(id: string, done: boolean): void {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, done } : task))
  }

  function handleRemoveTask(id: string): void {
    setTasks(prev => prev.filter(task => task.id !== id))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    setSaving(true)
    setError(null)

    const cleanedTasks = tasks
      .map(task => ({ ...task, text: task.text.trim() }))
      .filter(task => task.text.length > 0)

    try {
      if (editingId) {
        const updated = milestones.map(milestone =>
          milestone.id === editingId
            ? {
                ...milestone,
                title: trimmedTitle,
                description: description.trim(),
                imageFile,
                completionDate: completionDate || undefined,
                tasks: cleanedTasks
              }
            : milestone
        )
        await persistMilestones(updated)
      } else {
        const newMilestone: Milestone = {
          id: createId('milestone'),
          title: trimmedTitle,
          description: description.trim(),
          imageFile,
          completionDate: completionDate || undefined,
          tasks: cleanedTasks,
          createdAt: new Date().toISOString()
        }
        await persistMilestones([newMilestone, ...milestones])
      }
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('milestones.saveError'))
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(milestone: Milestone): void {
    setEditingId(milestone.id)
    setTitle(milestone.title)
    setDescription(milestone.description)
    setImageFile(milestone.imageFile)
    setImageDataUrl(milestone.imageFile ? (imageCache[milestone.imageFile] ?? null) : null)
    setImageUrl('')
    setImageSource('file')
    setCompletionDate(toDateInputValue(milestone.completionDate))
    setTasks(milestone.tasks.map(task => ({ ...task })))
    setNewTaskText('')
    setError(null)
    scrollToForm()
  }

  async function handleDelete(id: string): Promise<void> {
    await persistMilestones(milestones.filter(milestone => milestone.id !== id))
    if (editingId === id) resetForm()
  }

  async function handleToggleTask(milestoneId: string, taskId: string): Promise<void> {
    const updated = milestones.map(milestone =>
      milestone.id === milestoneId
        ? {
            ...milestone,
            tasks: milestone.tasks.map(task => task.id === taskId ? { ...task, done: !task.done } : task)
          }
        : milestone
    )
    await persistMilestones(updated)
  }

  const sortedMilestones = useMemo(() => {
    return milestones.slice().sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      return bTime - aTime
    })
  }, [milestones])

  const isEditing = editingId !== null

  return (
    <div className="page-container milestones-page">
      <h2 className="page-title">
        <Target size={22} className="page-title-icon" aria-hidden="true" />
        {t('milestones.pageTitle')}
      </h2>

      <section className="form-section">
        <div className="wood-panel">
          <h3 className="panel-section-title">
            {isEditing ? t('milestones.editTitle') : t('milestones.newTitle')}
          </h3>
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="milestone-form-layout">
              <div className="item-form-fields">
                <div className="form-field">
                  <label className="form-label" htmlFor="milestone-title">
                    {t('milestones.titleLabel')}<span className="required-mark">*</span>
                  </label>
                  <input
                    id="milestone-title"
                    className="form-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={t('milestones.titlePlaceholder')}
                    autoComplete="off"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="milestone-description">
                    {t('milestones.descriptionLabel')}
                  </label>
                  <textarea
                    id="milestone-description"
                    className="form-input milestone-textarea"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('milestones.descriptionPlaceholder')}
                    rows={3}
                  />
                </div>

                <div className="form-row-two">
                  <div className="form-field">
                    <label className="form-label" htmlFor="milestone-completion-date">
                      {t('milestones.completionDateLabel')}
                    </label>
                    <input
                      id="milestone-completion-date"
                      className="form-input"
                      type="date"
                      value={completionDate}
                      onChange={e => setCompletionDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <span className="form-label">{t('milestones.imageLabel')}</span>
                  <div className="image-source-tabs">
                    <button
                      type="button"
                      className={`image-source-tab${imageSource === 'file' ? ' image-source-tab-active' : ''}`}
                      onClick={() => setImageSource('file')}
                    >
                      <FolderOpen size={13} aria-hidden="true" /> {t('items.sourceFile')}
                    </button>
                    <button
                      type="button"
                      className={`image-source-tab${imageSource === 'url' ? ' image-source-tab-active' : ''}`}
                      onClick={() => setImageSource('url')}
                    >
                      <Link size={13} aria-hidden="true" /> {t('items.sourceUrl')}
                    </button>
                  </div>

                  {imageSource === 'file' && (
                    <div className="pick-image-row">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handlePickImage}>
                        <FolderOpen size={14} aria-hidden="true" /> {t('milestones.selectImageBtn')}
                      </button>
                      {imageFile
                        ? <span className="image-filename"><Check size={13} aria-hidden="true" />{t('common.imageSelected')}</span>
                        : <span className="image-filename-empty">{t('common.noImageSelected')}</span>
                      }
                      {imageFile && (
                        <button
                          type="button"
                          className="btn-icon-remove"
                          aria-label={t('milestones.removeImageAria')}
                          onClick={handleRemoveImage}
                          title={t('milestones.removeImageAria')}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}

                  {imageSource === 'url' && (
                    <div className="image-url-row">
                      <input
                        className="image-url-input"
                        type="url"
                        placeholder={t('milestones.urlPlaceholder')}
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        autoComplete="off"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleDownloadUrl() } }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleDownloadUrl()}
                        disabled={!imageUrl.trim() || downloadingUrl}
                      >
                        {downloadingUrl
                          ? <><RefreshCw size={14} className="market-status-spin" aria-hidden="true" />{t('items.downloading')}</>
                          : <><Download size={14} aria-hidden="true" />{t('items.downloadBtn')}</>
                        }
                      </button>
                      {imageFile && (
                        <>
                          <span className="image-filename"><Check size={13} aria-hidden="true" />{t('common.imageSelected')}</span>
                          <button
                            type="button"
                            className="btn-icon-remove"
                            aria-label={t('milestones.removeImageAria')}
                            onClick={handleRemoveImage}
                            title={t('milestones.removeImageAria')}
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-field">
                  <span className="form-label">{t('milestones.tasksLabel')}</span>
                  <div className="milestone-task-list-edit">
                    {tasks.map((task, index) => (
                      <div className="milestone-task-edit-row" key={task.id}>
                        <label className="milestone-task-check">
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={e => handleTaskDoneChange(task.id, e.target.checked)}
                          />
                          {task.done ? <CheckSquare size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
                        </label>
                        <input
                          className="form-input milestone-task-input"
                          value={task.text}
                          onChange={e => handleTaskTextChange(task.id, e.target.value)}
                          placeholder={t('milestones.taskPlaceholder', { n: index + 1 })}
                        />
                        <button
                          type="button"
                          className="btn-icon-sm btn-danger"
                          aria-label={t('milestones.removeTaskAria')}
                          onClick={() => handleRemoveTask(task.id)}
                          title={t('milestones.removeTaskAria')}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="milestone-add-task-row">
                    <input
                      className="form-input"
                      value={newTaskText}
                      onChange={e => setNewTaskText(e.target.value)}
                      placeholder={t('milestones.newTaskPlaceholder')}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask() } }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddTask}
                      disabled={!newTaskText.trim()}
                    >
                      <Plus size={14} aria-hidden="true" /> {t('milestones.addTaskBtn')}
                    </button>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
                    {saving
                      ? t('common.saving')
                      : isEditing
                        ? <><Save size={14} aria-hidden="true" /> {t('common.saveChanges')}</>
                        : <><Save size={14} aria-hidden="true" /> {t('milestones.createBtn')}</>
                    }
                  </button>
                  {isEditing && (
                    <button type="button" className="btn btn-secondary" onClick={resetForm}>
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </div>

              <div className="image-preview-column">
                <span className="form-label preview-label">{t('common.preview')}</span>
                <div className="image-preview-box milestone-preview-box">
                  {imageDataUrl
                    ? <img src={imageDataUrl} alt={t('milestones.previewAlt')} draggable={false} />
                    : <Target size={34} className="image-preview-placeholder" aria-hidden="true" />
                  }
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section>
        <div className="items-list-heading">
          <span>{t('milestones.registeredMilestones')}</span>
          <span className="items-count">{milestones.length}</span>
        </div>

        {!loaded ? (
          <p className="loading-text">{t('common.loading')}</p>
        ) : sortedMilestones.length === 0 ? (
          <div className="empty-state">
            <Target size={48} className="empty-state-icon" aria-hidden="true" />
            <span className="empty-state-text">{t('milestones.emptyState')}</span>
          </div>
        ) : (
          <ul className="milestone-list" role="list">
            {sortedMilestones.map(milestone => {
              const completed = milestone.tasks.filter(task => task.done).length
              const total = milestone.tasks.length
              const pendingTasks = milestone.tasks.filter(task => !task.done)
              const progress = total > 0 ? Math.round((completed / total) * 100) : 0
              const img = milestone.imageFile ? imageCache[milestone.imageFile] : null

              return (
                <li
                  key={milestone.id}
                  className={`milestone-card${editingId === milestone.id ? ' milestone-card-editing' : ''}`}
                >
                  <div className="milestone-card-image">
                    {img
                      ? <img src={img} alt={milestone.title} draggable={false} />
                      : <ImageIcon size={30} className="item-image-placeholder" aria-hidden="true" />
                    }
                  </div>

                  <div className="milestone-card-body">
                    <div className="milestone-card-top">
                      <div className="milestone-title-wrap">
                        <span className="milestone-card-title" title={milestone.title}>{milestone.title}</span>
                        <span className="milestone-date-chip">
                          <CalendarDays size={12} aria-hidden="true" />
                          {t('milestones.createdAtLabel', { date: formatDate(milestone.createdAt) })}
                        </span>
                        {milestone.completionDate && (
                          <span className="milestone-date-chip milestone-date-chip-target">
                            <Target size={12} aria-hidden="true" />
                            {t('milestones.targetDateLabel', { date: formatDate(milestone.completionDate) })}
                          </span>
                        )}
                      </div>

                      <div className="item-row-actions">
                        <button
                          className="btn-labeled btn-labeled-edit"
                          aria-label={t('milestones.editAria', { title: milestone.title })}
                          onClick={() => handleEdit(milestone)}
                        >
                          <Pencil size={13} aria-hidden="true" />
                          {t('common.edit')}
                        </button>
                        <button
                          className="btn-labeled btn-labeled-delete"
                          aria-label={t('milestones.deleteAria', { title: milestone.title })}
                          onClick={() => void handleDelete(milestone.id)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>

                    {milestone.description && (
                      <p className="milestone-description">{milestone.description}</p>
                    )}

                    {total > 0 && (
                      <div className="milestone-progress-block">
                        <div className="milestone-progress-meta">
                          <span>{t('milestones.progressLabel')}</span>
                          <strong>{completed}/{total} · {progress}%</strong>
                        </div>
                        <div className="milestone-progress-track" aria-hidden="true">
                          <div className="milestone-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}

                    {pendingTasks.length > 0 ? (
                      <ul className="milestone-pending-list" aria-label={t('milestones.pendingTasksAria')}>
                        {pendingTasks.map(task => (
                          <li key={task.id}>
                            <button
                              type="button"
                              className="milestone-list-check"
                              onClick={() => void handleToggleTask(milestone.id, task.id)}
                              aria-label={t('milestones.completeTaskAria', { task: task.text })}
                            >
                              <Square size={15} aria-hidden="true" />
                            </button>
                            <span>{task.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : total > 0 ? (
                      <div className="milestone-complete-note">
                        <CheckSquare size={15} aria-hidden="true" />
                        {t('milestones.allTasksDone')}
                      </div>
                    ) : (
                      <div className="milestone-complete-note milestone-no-tasks">
                        <FileImage size={15} aria-hidden="true" />
                        {t('milestones.noTasks')}
                      </div>
                    )}

                    {total > 0 && completed > 0 && (
                      <details className="milestone-done-details">
                        <summary>{t('milestones.completedTasksLabel', { count: completed })}</summary>
                        <ul className="milestone-pending-list milestone-done-list">
                          {milestone.tasks.filter(task => task.done).map(task => (
                            <li key={task.id}>
                              <button
                                type="button"
                                className="milestone-list-check milestone-list-check-done"
                                onClick={() => void handleToggleTask(milestone.id, task.id)}
                                aria-label={t('milestones.reopenTaskAria', { task: task.text })}
                              >
                                <CheckSquare size={15} aria-hidden="true" />
                              </button>
                              <span>{task.text}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default MilestonesPage
