"use client";

import { useState, useTransition } from "react";
import { addComment } from "@/lib/actions/league-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { Comment } from "@/lib/types/database";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function CommentWall({
  leagueId,
  comments,
}: {
  leagueId: string;
  comments: Comment[];
}) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      await addComment(leagueId, content.trim());
      setContent("");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Trash Talk Wall
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit} className="mb-4 space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Talk your smack..."
          rows={2}
          maxLength={500}
        />
        <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
          {isPending ? "Posting..." : "Post"}
        </Button>
      </form>

      <div className="max-h-80 space-y-3 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-zinc-500">Be the first to talk trash.</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg bg-zinc-800/50 px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-emerald-400">
                  {(comment.profile as { display_name: string })?.display_name ??
                    "Unknown"}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatDistanceToNow(new Date(comment.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-300">{comment.content}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
