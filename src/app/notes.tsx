

'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { saveNote, updateNote, deleteNote, type Note, toggleNoteCompletion } from '@/lib/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { withErrorHandling } from '@/lib/async-wrapper';

export function NotesSection() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [noteText, setNoteText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNoteText, setEditingNoteText] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const notesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/notes`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);

    const { data: notes, isLoading } = useCollection<Note>(notesQuery);

    const handleSaveNote = async () => {
        if (!noteText.trim() || !user || !firestore) return;
        setIsSaving(true);
        const { error } = await withErrorHandling(() => saveNote(firestore, user, noteText));
        
        if (!error) {
            setNoteText('');
            toast({ title: "Note enregistrée", description: "Votre note a été ajoutée avec succès." });
        }
        setIsSaving(false);
    };
    
    const startEditing = (note: Note) => {
        setEditingNoteId(note.id);
        setEditingNoteText(note.text);
    };

    const cancelEditing = () => {
        setEditingNoteId(null);
        setEditingNoteText('');
    };

    const handleUpdateNote = async () => {
        if (!editingNoteId || !editingNoteText.trim() || !user || !firestore) return;
        setIsUpdating(true);
        const { error } = await withErrorHandling(() => 
            updateNote(firestore, user.uid, editingNoteId, editingNoteText)
        );

        if (!error) {
            toast({ title: "Note modifiée", description: "Votre note a été mise à jour." });
            cancelEditing();
        }
        setIsUpdating(false);
    };
    
    const openDeleteDialog = (note: Note) => {
        setNoteToDelete(note);
    };

    const handleDeleteNote = async () => {
        if (!noteToDelete || !user || !firestore) return;
        setIsDeleting(true);
        const { error } = await withErrorHandling(() => 
            deleteNote(firestore, user.uid, noteToDelete.id)
        );
        
        if (!error) {
            toast({ title: "Note supprimée", description: "La note a été supprimée." });
        }
        setNoteToDelete(null);
        setIsDeleting(false);
    };
    
    const handleToggleCompletion = async (note: Note) => {
        if (!user || !firestore) return;
        await withErrorHandling(() =>
            toggleNoteCompletion(firestore, user.uid, note.id, !note.completed)
        );
        // Pas de notification pour cette action rapide
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Bloc-notes / To-do du jour</CardTitle>
                <CardDescription>
                    Utilisez cet espace pour noter rapidement des idées, des tâches ou toute autre information.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Textarea
                        placeholder="Écrivez quelque chose..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        disabled={isSaving}
                    />
                     <Button onClick={handleSaveNote} disabled={isSaving || !noteText.trim() || !!editingNoteId}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        {isSaving ? 'Enregistrement...' : 'Enregistrer la note'}
                    </Button>
                </div>
                
                <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>
                            <h4 className="font-medium">Vos notes :</h4>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-2 pt-2">
                                {isLoading && (
                                    <div className="space-y-2">
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                    </div>
                                )}
                                {!isLoading && (!notes || notes.length === 0) && (
                                    <p className="text-sm text-muted-foreground">Aucune note pour le moment.</p>
                                )}
                                <ul className="space-y-2">
                                    {notes?.map((note) => (
                                        <li key={note.id} className="p-3 bg-muted/50 rounded-md border text-sm group">
                                            {editingNoteId === note.id ? (
                                                <div className="space-y-2">
                                                    <Textarea
                                                        value={editingNoteText}
                                                        onChange={(e) => setEditingNoteText(e.target.value)}
                                                        rows={3}
                                                        disabled={isUpdating}
                                                        autoFocus
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" onClick={handleUpdateNote} disabled={isUpdating || !editingNoteText.trim()}>
                                                            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                            Enregistrer
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isUpdating}>
                                                            <X className="mr-2 h-4 w-4" />
                                                            Annuler
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        id={`note-${note.id}`}
                                                        checked={note.completed}
                                                        onCheckedChange={() => handleToggleCompletion(note)}
                                                        className="mt-1"
                                                    />
                                                    <div className="flex-1">
                                                        <label 
                                                            htmlFor={`note-${note.id}`}
                                                            className={cn(
                                                                "whitespace-pre-wrap transition-colors cursor-pointer",
                                                                note.completed && "line-through text-muted-foreground"
                                                            )}
                                                        >
                                                            {note.text}
                                                        </label>
                                                        <div className="flex items-center justify-between mt-2">
                                                            <p className="text-xs text-muted-foreground">
                                                                {note.createdAt && formatDistanceToNow(note.createdAt.toDate(), { addSuffix: true, locale: fr })}
                                                            </p>
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditing(note)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(note)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>

             <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette note ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. La note sera définitivement supprimée.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteNote} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

