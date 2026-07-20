import {useState} from "react"

const moderationArray: {
    id: number, actionType: string, affectedMember: string, listing: string, adminID: number, timestamp: string, reason: string 
}[] = [
  {
    id: 1,
    actionType: "Account suspended",
    affectedMember: "Member 1",
    listing: "unsafeTool1",
    adminID: 1,
    timestamp: "2026-07-03",
    reason: "Safety concern"
  },
 {
    id: 2,
    actionType: "Account suspended",
    affectedMember: "Member 2",
    listing: "unsafeTool2",
    adminID: 1,
    timestamp: "2026-04-03",
    reason: "Safety concern"
  },
  {
    id: 3,
    actionType: "Account suspended",
    affectedMember: "Member 8",
    listing: "unsafeTool3",
    adminID: 2,
    timestamp: "2026-02-13",
    reason: "Safety concern"
  },
  {
    id: 4,
    actionType: "Account suspended",
    affectedMember: "Member 5",
    listing: "unsafe tool4",
    adminID: 3,
    timestamp: "2026-03-12",
    reason: "Safety concern"
  }
];



function ModerationHistoryPage() {
  const [searchText, setSearchText] = useState("");
  const [adminID, setAdminID] = useState("");
  const [date, setDate] = useState("");

  function dealClick(){
    setSearchText("");
    setAdminID("");
    setDate("");
  }

const filteredModerations = moderationArray.filter((moderation) => {
  const matchesSearch = 
    moderation.affectedMember.toLowerCase().includes(searchText.toLowerCase()) ||  moderation.listing.toLowerCase().includes(searchText.toLowerCase());
    const matchesAdminID = adminID === "" || moderation.adminID === Number(adminID);
    const matchesDate = date === "" || (moderation.timestamp == date);

    return matchesSearch && matchesAdminID && matchesDate;
  });

  return (
    <>
      <section className="page-section">
        <div className="page-header">
          <div>
            <p className="eyebrow">User Story 32</p>
            <h1>Admin Moderation History Page</h1>
            <p className="page-description">Admin can see moderation history log</p>
          </div>
        </div>
            
        <div className="filter-panel">
          <input type="text" value={searchText} placeholder="Enter affected member name, listing or reason" onChange={(e)=>setSearchText(e.target.value)} />
          <select value={adminID} onChange={(e) => setAdminID(e.target.value)}>
            <option value="1">Admin 1</option>
            <option value="2">Admin 2</option>
            <option value="3">Admin 3</option>
          </select>
          <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
          <div className="">
            <button className="invite-button" onClick={dealClick}>Clear Filters</button>
          </div>
        </div>
    

        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Affected Member</th>
                <th>Action Type</th>
                <th>Admin ID</th>
                <th>Listing</th>
                <th>Timestamp</th>
                <th>Reason</th>
              </tr>
            </thead>

            <tbody>
              {filteredModerations.map((moderation) =>(
                <tr key={moderation.id}>
                  <td>{moderation.id}</td>
                  <td>{moderation.affectedMember}</td>
                  <td>{moderation.actionType}</td>
                  <td>{moderation.adminID}</td>
                  <td>{moderation.listing}</td>
                  <td>{moderation.timestamp}</td>
                  <td>{moderation.reason}</td>
                </tr>
              ))}

              {filteredModerations.length === 0 && (
                <p>There is no moderations that match your filtering</p>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default ModerationHistoryPage
