import "../app/globals.css"

const UserCard = ({ type }: { type: string }) => {
  return (
    <div className="rounded-2xl odd:bg-jayPurple even:bg-jayYellow p-4 h-24">Card</div>
  )
};

export default UserCard;