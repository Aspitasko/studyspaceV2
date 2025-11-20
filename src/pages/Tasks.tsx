import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle2, Circle, Trash2, Bold, Italic, Underline, List, Paperclip, X, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { uploadFile, deleteFile, getFileUrl, formatFileSize, getFileIcon } from '@/lib/file-upload';

interface Task {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  due_date: string | null;
  created_at: string;
  user_id: string;
}

interface TaskAttachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
}

// Component to handle line breaks and spacing in task descriptions
const TaskDescription = ({ content }: { content: string }) => {
  return (
    <div className="space-y-0">
      {content.split('\n').map((line, index) => {
        // Preserve empty lines with a non-breaking space
        if (line.trim() === '') {
          return <div key={index} className="h-3">&nbsp;</div>;
        }
        return (
          <div key={index} className="prose prose-sm dark:prose-invert prose-headings:text-xs prose-p:text-sm prose-li:text-sm max-w-none">
            <ReactMarkdown>{line}</ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
};

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tasksLocked, setTasksLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const { toast } = useToast();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if tasks are locked and if user is admin
  useEffect(() => {
    const checkSettings = async () => {
      const { data: settings } = await supabase.from('settings').select('tasks_locked').single() as any;
      if (settings) setTasksLocked(settings.tasks_locked);

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single() as any;
      if (profile) setIsAdmin(profile.is_admin);
    };

    checkSettings();
  }, [user]);

  // Formatting functions
  const insertFormatting = (before: string, after: string = '') => {
    if (!descriptionRef.current) return;
    const start = descriptionRef.current.selectionStart;
    const end = descriptionRef.current.selectionEnd;
    const selectedText = description.substring(start, end) || 'text';
    const newDescription = description.substring(0, start) + before + selectedText + after + description.substring(end);
    setDescription(newDescription);
  };

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedAttachments([...selectedAttachments, ...files]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedAttachments(selectedAttachments.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (taskId: string) => {
    if (selectedAttachments.length === 0) return;
    
    setUploading(true);
    try {
      for (const file of selectedAttachments) {
        const result = await uploadFile(file, 'task-attachments', user?.id || '');
        
        if (result.success && result.path) {
          // Save attachment metadata to database
          const { error } = await supabase.from('task_attachments').insert({
            task_id: taskId,
            user_id: user?.id,
            file_name: result.fileName,
            file_size: result.fileSize,
            file_type: result.fileType,
            storage_path: result.path,
          });

          if (error) {
            toast({
              title: 'Error',
              description: 'Failed to save attachment metadata',
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Failed to upload file',
            variant: 'destructive',
          });
        }
      }
      
      setSelectedAttachments([]);
      await fetchTaskAttachments(taskId);
      
      toast({
        title: 'Success',
        description: `${selectedAttachments.length} file(s) uploaded`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload attachments',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const fetchTaskAttachments = async (taskId: string) => {
    const { data, error } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId);

    if (!error && data) {
      setAttachments(data);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, storagePath: string) => {
    try {
      // Delete from storage
      const result = await deleteFile('task-attachments', storagePath);
      
      if (result.success) {
        // Delete from database
        const { error } = await supabase
          .from('task_attachments')
          .delete()
          .eq('id', attachmentId);

        if (!error) {
          setAttachments(attachments.filter(a => a.id !== attachmentId));
          toast({
            title: 'Success',
            description: 'Attachment deleted',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete attachment',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTasks(data);
      // Load attachments for all tasks
      if (data.length > 0) {
        const { data: attachmentData } = await supabase
          .from('task_attachments')
          .select('*')
          .in('task_id', data.map(t => t.id));
        if (attachmentData) {
          setAttachments(attachmentData);
        }
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if tasks are locked
    if (tasksLocked && !isAdmin) {
      toast({
        title: 'Tasks Locked',
        description: 'Only admins can create tasks at this time.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase.from('tasks').insert({
      user_id: user?.id,
      title,
      description: description || null,
      due_date: dueDate || null,
    }).select().single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive',
      });
    } else {
      // Upload attachments if any
      if (selectedAttachments.length > 0) {
        await uploadAttachments(data.id);
      }

      toast({
        title: 'Success',
        description: 'Task created successfully',
      });
      setOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      setSelectedAttachments([]);
      fetchTasks();
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !completed })
      .eq('id', taskId);

    if (!error) {
      fetchTasks();
    }
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Deleted',
        description: 'Task deleted successfully',
      });
      fetchTasks();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Track your assignments and deadlines</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={tasksLocked && !isAdmin} title={tasksLocked && !isAdmin ? 'Tasks are locked - only admins can create' : ''}>
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <p className="text-sm text-muted-foreground">Add a new task to your list. All fields except title are optional.</p>
            </DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <div className="flex gap-1 mb-2 flex-wrap">
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormatting('**', '**')} title="Bold">
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormatting('*', '*')} title="Italic">
                    <Italic className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormatting('__', '__')} title="Underline">
                    <Underline className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormatting('- ', '')} title="List">
                    <List className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormatting('# ', '')} title="Heading">
                    H1
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormatting('`', '`')} title="Code">
                    &lt;/&gt;
                  </Button>
                </div>
                <Textarea
                  ref={descriptionRef}
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Use formatting buttons above or type markdown..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input
                  id="dueDate"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* File Upload Section */}
              <div className="space-y-2 w-full">
                <Label>Attachments (Optional)</Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="*/*"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Add Files
                  </Button>
                </div>

                {/* Selected Files Preview */}
                {selectedAttachments.length > 0 && (
                  <div className="space-y-2 p-2 bg-secondary/30 rounded-md">
                    {selectedAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-secondary/50 rounded text-sm">
                        <span className="truncate">{file.name} ({formatFileSize(file.size)})</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSelectedFile(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? 'Creating & Uploading...' : 'Create Task'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id} className="shadow-card hover:shadow-card-hover transition-smooth">
            <CardContent className="flex items-start gap-4 pt-6">
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => toggleTask(task.id, task.completed)}
                className="mt-1"
              />
              <div className="flex-1">
                <h3 className={`font-semibold text-white ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </h3>
                {task.description && (
                  <div className="text-sm text-white/80 mt-1">
                    <TaskDescription content={task.description} />
                  </div>
                )}
                {task.due_date && (
                  <p className="text-xs text-white/70 mt-2">
                    Due: {new Date(task.due_date).toLocaleString()}
                  </p>
                )}

                {/* Attachments Display */}
                {attachments.filter(a => a.task_id === task.id).length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <p className="text-xs font-medium text-white/80">Attachments:</p>
                    <div className="space-y-1">
                      {attachments.filter(a => a.task_id === task.id).map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between text-xs p-1 bg-secondary/30 rounded">
                          <a
                            href={getFileUrl('task-attachments', attachment.storage_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-accent hover:underline truncate"
                          >
                            <span>{getFileIcon(attachment.file_type)}</span>
                            <span className="truncate">{attachment.file_name}</span>
                            <Download className="h-3 w-3" />
                          </a>
                          {user?.id === task.user_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={() => handleDeleteAttachment(attachment.id, attachment.storage_path)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {user?.id === task.user_id && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteTask(task.id)}
                  aria-label="Delete Task"
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                </Button>
              )}
              {task.completed ? (
                <CheckCircle2 className="h-5 w-5 text-accent" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {tasks.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tasks yet. Create your first one!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Tasks;
