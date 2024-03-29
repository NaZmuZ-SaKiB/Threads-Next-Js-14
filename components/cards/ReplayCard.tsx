import Image from "next/image";
import Link from "next/link";
import ThreadCard from "./ThreadCard";

const ReplayCard = ({
  thread,
  reply,
  currentUser_Id,
}: {
  thread: any;
  reply: any;
  currentUser_Id: string;
}) => {
  return (
    <div>
      <Link
        href={`/echo/${thread?._id}`}
        className={`flex w-full flex-col rounded-xl bg-dark-4 opacity-50 p-5 max-h-20 max-w-[70%] overflow-hidden max-sm:p-3`}
      >
        <div className="flex items-start justify-between">
          <div className="flex w-full flex-1 flex-row gap-4 max-sm:gap-3">
            <div className="flex flex-col items-center">
              <div className="relative size-11 max-sm:size-9">
                <Image
                  src={thread?.author?.image}
                  alt="Profile image"
                  fill
                  className="rounded-full"
                />
              </div>
              <div className="thread-card_bar" />
            </div>

            <div className="flex w-full flex-col">
              <div className="w-fit">
                <h4 className="text-base-semibold text-light-1">
                  {thread?.author?.name}
                </h4>
              </div>
              <p className="mt-2 text-small-regular text-light-2">
                {thread?.text}
              </p>
            </div>
          </div>
        </div>
      </Link>

      <ThreadCard
        key={`${reply._id}`}
        currentUser_Id={currentUser_Id}
        JSONThread={JSON.stringify(reply)}
        isComment={false}
      />
    </div>
  );
};

export default ReplayCard;
