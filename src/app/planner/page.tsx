
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, updateDoc, doc, Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, Edit, FileText, Clock, Trash2, MoreHorizontal, Share2, Facebook, MessageSquare, Instagram, VenetianMask, Building, List, CalendarDays, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { format, formatDistanceToNow, isSameDay, startOfMonth, addMonths, subMonths, getDaysInMonth, getDay, startOfWeek, addDays, endOfMonth, endOfWeek, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ScheduledPost, BrandProfile } from '@/lib/firestore';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useStorage } from '@/firebase'; 
import { getDownloadURL, ref } from 'firebase/storage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FirebaseStorage } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { deleteScheduledPost } from '@/lib/firestore';
import { withErrorHandling } from '@/lib/async-wrapper';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/time-picker';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';


function ShareDialog({ post, imageUrl, brandProfile }: { post: ScheduledPost, imageUrl: string | null, brandProfile: BrandProfile | null }) {
    if (!imageUrl) return null;

    const fullText = `${post.title}\n\n${post.description}`.trim();
    
    // Utiliser les URLs du profil de marque si elles existent, sinon, utiliser les URLs génériques
    const twitterShareUrl = brandProfile?.socialLinks?.find(l => l.name === 'X (Twitter)')?.url
        ? `${brandProfile.socialLinks.find(l => l.name === 'X (Twitter)')?.url}/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(imageUrl)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(imageUrl)}`;
        
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`;
    const instagramUrl = brandProfile?.socialLinks?.find(l => l.name === 'Instagram')?.url || 'https://www.instagram.com';
    const tiktokUrl = brandProfile?.socialLinks?.find(l => l.name === 'TikTok')?.url || 'https://www.tiktok.com';


    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Partager maintenant pour "{brandProfile?.name || 'Profil par défaut'}"</DialogTitle>
                <DialogDescription>
                    Choisissez une plateforme pour partager votre post. Le texte et le lien de l'image seront préparés pour vous.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                 <Button asChild variant="outline" className="h-12 border-pink-500 text-pink-600 hover:bg-pink-500/10 hover:text-pink-600">
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                        <Instagram className="mr-2 h-5 w-5" />
                        Ouvrir Instagram
                    </a>
                </Button>
                <Button asChild variant="outline" className="h-12 border-[#1DA1F2] text-[#1DA1F2] hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2]">
                    <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer">
                        <MessageSquare className="mr-2 h-5 w-5" />
                        Partager sur X
                    </a>
                </Button>
                <Button asChild variant="outline" className="h-12 border-black text-black dark:border-white dark:text-white hover:bg-black/10 dark:hover:bg-white/10">
                    <a href={tiktokUrl} target="_blank" rel="noopener noreferrer">
                        <VenetianMask className="mr-2 h-5 w-5" />
                        Ouvrir TikTok
                    </a>
                </Button>
                <Button asChild variant="outline" className="h-12 border-[#1877F2] text-[#1877F2] hover:bg-[#1877F2]/10 hover:text-[#1877F2]">
                    <a href={facebookShareUrl} target="_blank" rel="noopener noreferrer">
                        <Facebook className="mr-2 h-5 w-5 fill-current" />
                        Partager sur Facebook
                    </a>
                </Button>
            </div>
             <p className="text-xs text-muted-foreground text-center">
                Note : Vous devrez peut-être ajouter l'image manuellement sur le réseau social.
            </p>
        </DialogContent>
    );
}

// --- Nouveau composant DraggablePostCard ---
function DraggablePostCard({ post, storage, brandProfiles, onDelete }: { post: ScheduledPost, storage: FirebaseStorage | null, brandProfiles: BrandProfile[] | null, onDelete: (post: ScheduledPost) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: post.id,
    data: post, // On attache les données du post au draggable
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
        <PostCard post={post} storage={storage} brandProfiles={brandProfiles} onDelete={onDelete} draggableListeners={listeners} />
    </div>
  );
}


function PostCard({ post, storage, brandProfiles, onDelete, draggableListeners }: { post: ScheduledPost, storage: FirebaseStorage | null, brandProfiles: BrandProfile[] | null, onDelete: (post: ScheduledPost) => void, draggableListeners?: any }) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const router = useRouter();

    const brandProfile = useMemo(() => brandProfiles?.find(p => p.id === post.brandProfileId), [brandProfiles, post.brandProfileId]);

    useEffect(() => {
        if (storage && post.imageStoragePath) {
            const imageRef = ref(storage, post.imageStoragePath);
            getDownloadURL(imageRef)
                .then(url => {
                    setImageUrl(url);
                })
                .catch(error => {
                    console.error("Erreur de chargement de l'image du post:", error);
                    setImageUrl(null);
                })
                .finally(() => {
                    setIsImageLoading(false);
                });
        } else {
            setIsImageLoading(false);
        }
    }, [storage, post.imageStoragePath]);

    const isScheduled = post.status === 'scheduled' && post.scheduledAt;

    const handleEdit = () => {
        if (post.auditId) {
            router.push(`/audit/resultats/${post.auditId}`);
        }
    };

    return (
        <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
            <Card className="flex flex-col overflow-hidden transition-all hover:shadow-md">
                <div className="relative aspect-video bg-muted">
                    {isImageLoading ? (
                        <div className="flex h-full w-full items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : imageUrl ? (
                        <Image src={imageUrl} alt={post.title} fill className="object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <FileText className="h-8 w-8" />
                        </div>
                    )}
                </div>
                <CardHeader>
                    <div className="flex items-start justify-between">
                         <div className="flex flex-col gap-2 flex-1 min-w-0">
                            <Badge variant={isScheduled ? "default" : "secondary"} className={cn("w-fit", isScheduled && "bg-blue-600 text-white")}>
                                {isScheduled ? 'Programmé' : 'Brouillon'}
                            </Badge>
                             {brandProfile && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Avatar className="h-4 w-4">
                                        <AvatarImage src={brandProfile.avatarUrl} alt={brandProfile.name} />
                                        <AvatarFallback className="text-[8px]">{brandProfile.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{brandProfile.name}</span>
                                </div>
                            )}
                        </div>
                         <div className="flex items-center flex-shrink-0">
                             {draggableListeners && (
                                <div {...draggableListeners} className="cursor-grab p-2 -m-2">
                                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </div>
                             )}
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DialogTrigger asChild>
                                        <DropdownMenuItem>
                                            <Share2 className="mr-2 h-4 w-4" />
                                            Partager maintenant
                                        </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleEdit} disabled={!post.auditId}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDelete(post)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Supprimer
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                         </div>
                    </div>
                    <CardTitle className="mt-2 text-lg">{post.title}</CardTitle>
                    {isScheduled && (
                        <CardDescription className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4" />
                            Pour le {format(post.scheduledAt.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                        {post.description}
                    </p>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                    Créé {formatDistanceToNow(post.createdAt.toDate(), { locale: fr, addSuffix: true })}
                </CardFooter>
            </Card>
            <ShareDialog post={post} imageUrl={imageUrl} brandProfile={brandProfile} />
        </Dialog>
    );
}

type ScheduledPostWithImage = ScheduledPost & { imageUrl?: string | null };

function CalendarDay({ day, posts, isCurrentMonth, isToday }: { day: Date, posts: ScheduledPostWithImage[], isCurrentMonth: boolean, isToday: boolean }) {
    const { setNodeRef } = useDroppable({
        id: format(day, 'yyyy-MM-dd'),
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "h-48 p-1.5 border-r border-b relative flex flex-col",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                isToday && "bg-primary/10"
            )}
        >
            <span className={cn(
                "text-xs font-semibold mb-1", 
                !isCurrentMonth && "opacity-50",
                isToday && "text-primary font-bold"
            )}>
                {format(day, 'd')}
            </span>
            <div className="space-y-1 overflow-y-auto flex-1">
                {posts.map(post => {
                    const brandProfile = null; // Mettre la logique pour récupérer le profil de marque
                    return (
                        <Popover key={post.id}>
                            <PopoverTrigger asChild>
                                <div className="w-full p-1 bg-blue-100 dark:bg-blue-900/50 rounded-sm overflow-hidden flex items-center gap-1.5 cursor-pointer hover:ring-2 hover:ring-primary">
                                    {post.imageUrl ? (
                                        <Image src={post.imageUrl} alt={post.title} width={20} height={20} className="object-cover h-5 w-5 rounded-sm" />
                                    ) : (
                                        <div className="h-5 w-5 bg-muted rounded-sm flex-shrink-0"></div>
                                    )}
                                    <p className="text-xs font-medium text-blue-800 dark:text-blue-200 truncate flex-1">{post.title}</p>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-64" align="start">
                                <div className="space-y-2">
                                    <h4 className="font-semibold leading-none">{post.title}</h4>
                                    <p className="text-sm text-muted-foreground line-clamp-3">{post.description}</p>
                                    <p className="text-xs text-muted-foreground pt-1 border-t">
                                        À {format(post.scheduledAt!.toDate(), 'HH:mm')}
                                    </p>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )
                })}
            </div>
        </div>
    );
}

function CalendarView({ posts, brandProfiles, onDelete }: { posts: ScheduledPostWithImage[], brandProfiles: BrandProfile[] | null, onDelete: (post: ScheduledPost) => void }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const weekDays = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
    
    const calendarGrid = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        const days = [];
        let day = start;

        while (day <= end) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [currentMonth]);
    
    const postsByDay = useMemo(() => {
        const map = new Map<string, ScheduledPostWithImage[]>();
        posts.forEach(post => {
            if (post.scheduledAt) {
                const dayKey = format(post.scheduledAt.toDate(), 'yyyy-MM-dd');
                if (!map.has(dayKey)) {
                    map.set(dayKey, []);
                }
                map.get(dayKey)?.push(post);
            }
        });
        return map;
    }, [posts]);

    return (
         <div className="w-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</h3>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-7 border-t border-l rounded-t-lg overflow-hidden">
                {weekDays.map(day => (
                    <div key={day} className="p-2 text-center text-xs font-medium uppercase text-muted-foreground bg-muted/50 border-r border-b">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 border-l">
                {calendarGrid.map((day, index) => (
                    <CalendarDay
                        key={index}
                        day={day}
                        posts={postsByDay.get(format(day, 'yyyy-MM-dd')) || []}
                        isCurrentMonth={isSameMonth(day, currentMonth)}
                        isToday={isSameDay(day, new Date())}
                    />
                ))}
            </div>
        </div>
    );
}

export default function PlannerPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const router = useRouter();
    const { toast } = useToast();

    const [postToDelete, setPostToDelete] = useState<ScheduledPost | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('all');

    const sensors = useSensors(useSensor(PointerSensor));

    const [draggedPost, setDraggedPost] = useState<ScheduledPost | null>(null);
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [targetDate, setTargetDate] = useState<Date | null>(null);
    const [scheduleTime, setScheduleTime] = useState<Date | undefined>(new Date());
    const [isScheduling, setIsScheduling] = useState(false);


    const postsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/scheduledPosts`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: posts, isLoading: arePostsLoading } = useCollection<ScheduledPost>(postsQuery);

    const [postsWithImages, setPostsWithImages] = useState<ScheduledPostWithImage[]>([]);

    useEffect(() => {
        if (posts && storage) {
            const fetchImageUrls = async () => {
                const enrichedPosts = await Promise.all(
                    posts.map(async (post) => {
                        if (post.imageStoragePath) {
                            try {
                                const url = await getDownloadURL(ref(storage, post.imageStoragePath));
                                return { ...post, imageUrl: url };
                            } catch (error) {
                                console.error(`Failed to get image URL for post ${post.id}`, error);
                                return { ...post, imageUrl: null };
                            }
                        }
                        return { ...post, imageUrl: null };
                    })
                );
                setPostsWithImages(enrichedPosts);
            };
            fetchImageUrls();
        } else if (posts) {
            setPostsWithImages(posts.map(p => ({...p, imageUrl: null})));
        }
    }, [posts, storage]);


    const brandProfilesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/brandProfiles`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: brandProfiles, isLoading: areProfilesLoading } = useCollection<BrandProfile>(brandProfilesQuery);
    
    const filteredPosts = useMemo(() => {
        if (!postsWithImages) return [];
        if (selectedProfileId === 'all') return postsWithImages;
        return postsWithImages.filter(p => p.brandProfileId === selectedProfileId);
    }, [postsWithImages, selectedProfileId]);


    const scheduledPosts = useMemo(() => filteredPosts.filter(p => p.status === 'scheduled') || [], [filteredPosts]);
    const draftPosts = useMemo(() => filteredPosts.filter(p => p.status === 'draft') || [], [filteredPosts]);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login?redirect=/planner');
        }
    }, [user, isUserLoading, router]);

    const handleDelete = async () => {
        if (!user || !storage || !firestore || !postToDelete) return;
        setIsDeleting(true);
        const { error } = await withErrorHandling(() => 
            deleteScheduledPost(firestore, storage, user.uid, postToDelete)
        );
        
        if (!error) {
            toast({ title: "Post supprimé", description: "Le post a bien été supprimé de votre planificateur." });
        }
        setIsDeleting(false);
        setPostToDelete(null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { over, active } = event;
        if (over && active.data.current) {
            setDraggedPost(active.data.current as ScheduledPost);
            setTargetDate(new Date(over.id as string));
            setScheduleTime(new Date()); // Reset to current time
            setScheduleDialogOpen(true);
        }
    };
    
    const handleSchedule = async () => {
        if (!user || !firestore || !draggedPost || !targetDate || !scheduleTime) return;
        setIsScheduling(true);

        const newScheduledAt = new Date(targetDate);
        newScheduledAt.setHours(scheduleTime.getHours());
        newScheduledAt.setMinutes(scheduleTime.getMinutes());

        const postRef = doc(firestore, `users/${user.uid}/scheduledPosts`, draggedPost.id);
        const { error } = await withErrorHandling(() => 
            updateDoc(postRef, {
                status: 'scheduled',
                scheduledAt: Timestamp.fromDate(newScheduledAt)
            })
        );
        
        if (!error) {
            toast({ title: "Post programmé !", description: `Le post a été programmé pour le ${format(newScheduledAt, "d MMMM 'à' HH:mm", { locale: fr })}.` });
        }
        setIsScheduling(false);
        setScheduleDialogOpen(false);
    };


    if (isUserLoading || arePostsLoading || areProfilesLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="w-full max-w-7xl mx-auto space-y-8">
                    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Planificateur de Contenu</h1>
                            <p className="text-muted-foreground mt-1">Gérez vos brouillons et vos publications programmées par profil.</p>
                        </div>
                         {brandProfiles && brandProfiles.length > 0 && (
                            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                                <SelectTrigger 
                                    className={cn(
                                        "w-full sm:w-[280px]",
                                        selectedProfileId === 'all' && "bg-gradient-to-r from-blue-500 to-cyan-400 text-white border-blue-600 ring-offset-background focus:ring-blue-500"
                                    )}
                                >
                                    <SelectValue placeholder="Sélectionner un profil..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback><Building className="h-4 w-4"/></AvatarFallback>
                                            </Avatar>
                                            Tous les profils
                                        </div>
                                    </SelectItem>
                                    {brandProfiles.map(profile => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={profile.avatarUrl} alt={profile.name} />
                                                    <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                {profile.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         )}
                    </header>

                    <Tabs defaultValue="calendar" className="w-full">
                        <div className="flex justify-center mb-6">
                            <TabsList>
                                <TabsTrigger value="list"><List className="mr-2 h-4 w-4" />Vue Liste</TabsTrigger>
                                <TabsTrigger value="calendar"><CalendarDays className="mr-2 h-4 w-4" />Vue Calendrier</TabsTrigger>
                            </TabsList>
                        </div>
                        
                        <TabsContent value="list">
                            {!posts || posts.length === 0 ? (
                                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                                    <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">Votre planificateur est vide</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Générez des images avec le Coach Stratégique et sauvegardez-les en tant que brouillons ou programmez-les.
                                    </p>
                                    <Button asChild className="mt-4">
                                        <Link href="/audit">Aller au Coach Stratégique</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    <section>
                                        <h2 className="text-2xl font-semibold mb-4">Publications Programmées ({scheduledPosts.length})</h2>
                                        {scheduledPosts.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {scheduledPosts.map(post => <PostCard key={post.id} post={post} storage={storage} brandProfiles={brandProfiles} onDelete={setPostToDelete} />)}
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground">Aucune publication programmée pour ce profil.</p>
                                        )}
                                    </section>

                                    <section>
                                        <h2 className="text-2xl font-semibold mb-4">Brouillons ({draftPosts.length})</h2>
                                        {draftPosts.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {draftPosts.map(post => <DraggablePostCard key={post.id} post={post} storage={storage} brandProfiles={brandProfiles} onDelete={setPostToDelete} />)}
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground">Aucun brouillon sauvegardé pour ce profil.</p>
                                        )}
                                    </section>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="calendar">
                             <CalendarView posts={scheduledPosts} brandProfiles={brandProfiles} onDelete={setPostToDelete} />
                             <section className="mt-12">
                                <h2 className="text-2xl font-semibold mb-4">Brouillons ({draftPosts.length})</h2>
                                {draftPosts.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {draftPosts.map(post => (
                                             <DraggablePostCard key={post.id} post={post} storage={storage} brandProfiles={brandProfiles} onDelete={setPostToDelete} />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground">Aucun brouillon pour ce profil.</p>
                                )}
                            </section>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <AlertDialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce post ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Le post et son image associée seront définitivement supprimés si l'image n'est pas utilisée ailleurs.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Programmer le post</DialogTitle>
                        <DialogDescription>
                            Confirmez l'heure de publication pour le {targetDate && format(targetDate, 'd MMMM yyyy', { locale: fr })}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <TimePicker date={scheduleTime} setDate={setScheduleTime} />
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setScheduleDialogOpen(false)}>Annuler</Button>
                        <Button onClick={handleSchedule} disabled={isScheduling}>
                            {isScheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Programmer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DndContext>
    );
}
