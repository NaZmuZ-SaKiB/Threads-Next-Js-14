import ThreadCard from "@/components/cards/ThreadCard";
import { TCommunity } from "@/database/community/community.interface";
import { fetchThreads } from "@/database/thread/thread.actions";
import { TUser } from "@/database/user/user.interface";

const Home = async () => {
  const result = await fetchThreads(1, 30);

  return (
    <main>
      <h1 className="head-text">Home</h1>
      <section className="mt-9 flex flex-col gap-10">
        {result?.threads.length === 0 ? (
          <p className="no-result">No threads found</p>
        ) : (
          <>
            {result?.threads.map((thread) => (
              <ThreadCard
                key={thread._id.toString()}
                thread_Id={thread._id.toString()}
                currentUser_Id=""
                parent_Id={null}
                content={thread.text}
                author={thread.author as unknown as TUser}
                community={thread.community as unknown as TCommunity}
                createdAt={thread.createdAt!}
                comments={thread.replies}
              />
            ))}
          </>
        )}
      </section>
    </main>
  );
};

export default Home;
