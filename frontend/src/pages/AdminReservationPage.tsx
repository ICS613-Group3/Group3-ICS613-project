{/* Reference: https://www.geeksforgeeks.org/typescript/how-can-i-define-an-array-of-objects-in-typescript/ */}
{/* /Reference: https://react.dev/learn/responding-to-events */}
import {useState} from "react"

const reservationArray: {
  id: number, toolName: string, ownerName: string, borrowerName: string, startDate: string, endDate: string, status: string 
}[] = [
  {
    id: 1,
    toolName: "Tool 1",
    ownerName: "Member 1",
    borrowerName: "Member 2",
    startDate: "2026-07-09",
    endDate: "2026-07-12",
    status: "Picked_Up"
  },
  {
    id: 2,
    toolName: "Tool 2",
    ownerName: "Member 3",
    borrowerName: "Member 4",
    startDate: "2026-07-11",
    endDate: "2026-07-12",
    status: "Approved"
  },
  {
    id: 3,
    toolName: "Tool 3",
    ownerName: "Member 5",
    borrowerName: "Member 6",
    startDate: "2026-07-10",
    endDate: "2026-07-16",
    status: "Picked_Up"
  },
  {
    id: 4,
    toolName: "Tool 4",
    ownerName: "Member 7",
    borrowerName: "Member 8",
    startDate: "2026-07-13",
    endDate: "2026-07-15",
    status: "Requested"
  },
];


function AdminReservationPage() {
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState("All");
  const [date, setDate] = useState("");

  function dealClick(){
    setSearchText("");
    setStatus("All");
    setDate("");
  }

  const filteredReservations = reservationArray.filter((reservation) => {
    const matchesSearch = 
      reservation.ownerName.toLowerCase().includes(searchText.toLowerCase()) || reservation.borrowerName.toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus = status === "All" || reservation.status === status;
      const matchesDate = date === "" || (reservation.startDate <= date && reservation.endDate >= date);
      return matchesSearch && matchesStatus && matchesDate;
  });



  return (
    <>
      <section className="page-section">
        <div className="page-header">
          <div>
            <p className="eyebrow">User Story 34</p>
            <h1>Admin Reservation Page</h1>
            <p className="page-description">Admin can see all active reservations</p>
          </div>
        </div>

        <div className="filter-panel">
          <input type="text" value={searchText} placeholder="Enter owner name or borrower name" onChange={(e)=>setSearchText(e.target.value)} />
          <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All</option>
            <option value="Requested">Requested</option>
            <option value="Approved">Approved</option>
            <option value="PickedUp">PuckedUp</option>
          </select>
          <div className="">
            <button className="action-button" onClick={dealClick}>Clear Filters</button>
          </div>
        </div>
  

        <div className="reservation-card">
          {filteredReservations.map((reservation) =>(
            <article className="reservation-card" key={reservation.id}>
              <span className={`workflow-status status-${reservation.status.toLowerCase()}`}>
                    {reservation.status}
              </span>
              <dl className="reservation-meta-grid">
                <div>
                  <dt>Tool Name</dt>
                  <dd><h2>{reservation.toolName}</h2></dd>
                </div>
                <div>
                  <dt>Owner Name</dt>
                  <dd><h2>{reservation.ownerName}</h2></dd>
                </div>
                <div>
                  <dt>Borrower Name</dt>
                  <dd><h2>{reservation.borrowerName}</h2></dd>
                </div>
                <div>
                  <dt>Date Range</dt>
                  <dd><h2>{reservation.startDate} - {reservation.endDate}</h2></dd>
                </div>
              </dl>
            </article>
          ))}

          {filteredReservations.length === 0 && (
            <p>There is no reservations that match your filtering</p>
          )}
        </div>
      </section>
    </>
  )
}
export default AdminReservationPage;