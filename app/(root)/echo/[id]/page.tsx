import { redirect } from "next/navigation";
import { fetchThreadById } from "@/database/thread/thread.actions";
import Comment from "@/components/forms/Comment";
import ThreadCard from "@/components/cards/ThreadCard";
import { currentUser } from "@/database/auth/auth.actions";

const ThreadPage = async ({ params }: { params: { id: string } }) => {
  if (!params.id) return null;

  const user = await currentUser();
  if (!user) return null;

  if (!user?.onboarded) redirect("/onboarding");

  const thread = await fetchThreadById(params.id);

  return (
    <section className="relative">
      <div>
        <ThreadCard
          currentUser_Id={`${user?._id}` || ""}
          JSONThread={JSON.stringify(thread)}
        />
      </div>

      <div className="mt-7">
        <Comment
          thread_Id={`${thread._id}`}
          currentUserImg={user.image || ""}
          currentUser_Id={`${user._id}`}
        />
      </div>

      <div className="mt-10">
        {thread.replies.map((reply) => (
          <ThreadCard
            key={`${reply._id}`}
            currentUser_Id={`${user?._id}` || ""}
            JSONThread={JSON.stringify(reply)}
            isComment={true}
          />
        ))}
      </div>
    </section>
  );
};

export default ThreadPage;
