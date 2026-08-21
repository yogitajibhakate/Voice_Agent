'use client';

import {
    Archive,
    Check,
    Folder as FolderIcon,
    FolderInput,
    Inbox,
    Pencil,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
    deleteWorkflowApiV1WorkflowWorkflowIdDelete,
    moveWorkflowToFolderApiV1WorkflowWorkflowIdFolderPut,
    updateWorkflowStatusApiV1WorkflowWorkflowIdStatusPut,
} from '@/client/sdk.gen';
import type { FolderResponse } from '@/client/types.gen';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
interface Workflow {
    id: number;
    name: string;
    status: string;
    created_at: string;
    total_runs?: number | null;
    folder_id?: number | null;
}

interface WorkflowTableProps {
    workflows: Workflow[];
    showArchived: boolean;
    /**
     * When provided, each row gets a "Move to folder" action listing these
     * folders. Omit it (e.g. for the archived list) to hide the control.
     */
    folders?: FolderResponse[];
    /** The folder this table is rendered under; null means "Uncategorized". */
    currentFolderId?: number | null;
}

export function WorkflowTable({
    workflows,
    showArchived,
    folders,
    currentFolderId = null,
}: WorkflowTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [loadingWorkflowId, setLoadingWorkflowId] = useState<number | null>(null);
    const [movingWorkflowId, setMovingWorkflowId] = useState<number | null>(null);
    const [deletingWorkflowId, setDeletingWorkflowId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (deletingWorkflowId === null) return;
        setIsDeleting(true);
        try {
            const response = await deleteWorkflowApiV1WorkflowWorkflowIdDelete({
                path: {
                    workflow_id: deletingWorkflowId,
                },
            });
            if (response.error) {
                throw new Error('Failed to delete agent');
            }
            toast.success('Agent deleted successfully');
            setDeletingWorkflowId(null);
            startTransition(() => {
                router.refresh();
            });
        } catch (error) {
            console.error('Error deleting workflow:', error);
            toast.error('Failed to delete agent');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEdit = (id: number) => {
        router.push(`/workflow/${id}`);
    };

    const handleArchiveToggle = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'archived' : 'active';
        const action = currentStatus === 'active' ? 'Archive' : 'Restore';

        setLoadingWorkflowId(id);

        try {
            const response = await updateWorkflowStatusApiV1WorkflowWorkflowIdStatusPut({
                path: {
                    workflow_id: id,
                },
                body: {
                    status: newStatus,
                },
            });

            if (response.data) {
                toast.success(`Workflow ${action.toLowerCase()}d successfully`);
                startTransition(() => {
                    router.refresh();
                });
            }
        } catch (error) {
            console.error(`Error ${action.toLowerCase()}ing workflow:`, error);
            toast.error(`Failed to ${action.toLowerCase()} workflow`);
        } finally {
            setLoadingWorkflowId(null);
        }
    };

    const handleMove = async (id: number, folderId: number | null) => {
        setMovingWorkflowId(id);
        try {
            const response = await moveWorkflowToFolderApiV1WorkflowWorkflowIdFolderPut({
                path: { workflow_id: id },
                body: { folder_id: folderId },
            });
            if (response.error) {
                throw new Error('Failed to move agent');
            }
            toast.success(
                folderId === null ? 'Moved to Uncategorized' : 'Agent moved',
            );
            startTransition(() => {
                router.refresh();
            });
        } catch (error) {
            console.error('Error moving workflow:', error);
            toast.error('Failed to move agent');
        } finally {
            setMovingWorkflowId(null);
        }
    };

    return (
        <>
            <Card className="overflow-hidden">
                <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-semibold">ID</TableHead>
                            <TableHead className="font-semibold">Agent Name</TableHead>
                            <TableHead className="font-semibold">Created At</TableHead>
                            <TableHead className="font-semibold text-center">Total Runs</TableHead>
                            <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {workflows.map((workflow) => (
                            <TableRow
                                key={workflow.id}
                                className={`hover:bg-accent transition-colors ${showArchived ? 'opacity-60' : ''}`}
                            >
                                <TableCell className="text-muted-foreground">
                                    {workflow.id}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {workflow.name}
                                </TableCell>
                                <TableCell>
                                    {new Date(workflow.created_at).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-sm font-semibold bg-muted rounded-full">
                                        {workflow.total_runs || 0}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEdit(workflow.id)}
                                            className="flex items-center gap-2"
                                        >
                                            <Pencil size={16} />
                                            Edit
                                        </Button>
                                        {folders && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={movingWorkflowId === workflow.id || isPending}
                                                        className="flex items-center gap-2"
                                                    >
                                                        {movingWorkflowId === workflow.id ? (
                                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                        ) : (
                                                            <FolderInput size={16} />
                                                        )}
                                                        Move
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuLabel>Move to folder</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        disabled={currentFolderId === null}
                                                        onClick={() => handleMove(workflow.id, null)}
                                                    >
                                                        <Inbox size={14} className="mr-2" />
                                                        Uncategorized
                                                        {currentFolderId === null && (
                                                            <Check size={14} className="ml-auto" />
                                                        )}
                                                    </DropdownMenuItem>
                                                    {folders.map((folder) => (
                                                        <DropdownMenuItem
                                                            key={folder.id}
                                                            disabled={folder.id === currentFolderId}
                                                            onClick={() => handleMove(workflow.id, folder.id)}
                                                        >
                                                            <FolderIcon size={14} className="mr-2" />
                                                            <span className="truncate">{folder.name}</span>
                                                            {folder.id === currentFolderId && (
                                                                <Check size={14} className="ml-auto shrink-0" />
                                                            )}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                        <Button
                                            variant={showArchived ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleArchiveToggle(workflow.id, workflow.status)}
                                            disabled={loadingWorkflowId === workflow.id || isPending}
                                            className="flex items-center gap-2"
                                        >
                                            {loadingWorkflowId === workflow.id ? (
                                                <>
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                    {showArchived ? 'Restoring...' : 'Archiving...'}
                                                </>
                                            ) : (
                                                <>
                                                    {showArchived ? (
                                                        <>
                                                            <RotateCcw size={16} />
                                                            Restore
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Archive size={16} />
                                                            Archive
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </Button>
                                        {showArchived && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setDeletingWorkflowId(workflow.id)}
                                                disabled={isPending}
                                                className="flex items-center gap-2"
                                            >
                                                <Trash2 size={16} />
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        {deletingWorkflowId !== null && (
            <AlertDialog open={deletingWorkflowId !== null} onOpenChange={(open) => !open && setDeletingWorkflowId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the agent, its configurations, and all of its past runs. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Agent'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
    </>
    );
}
