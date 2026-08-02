// Reference: https://www.geeksforgeeks.org/typescript/how-can-i-define-an-array-of-objects-in-typescript/
import {useState} from "react";
import Papa from "papaparse";

const listings: {
    listing_id: number, listingName: string, owner_id: number, ownerName: string, status: string, reported_by: string, reported_date: string
}[] = [
  {
    listing_id: 1,
    listingName: "Listing 1",
    owner_id: 1,
    ownerName: "owner1",
    status: "Active",
    reported_by: "member 4",
    reported_date: "2026-07-12"
  },
 {
    listing_id: 2,
    listingName: "Listing 2",
    owner_id: 2,
    ownerName: "owner2",
    status: "Deactivated",
    reported_by: "member 3",
    reported_date: "2026-07-22"
  },
  {
    listing_id: 3,
    listingName: "Listing 3",
    owner_id: 3,
    ownerName: "owner3",
    status: "Active",
    reported_by: "member 7",
    reported_date: "2026-07-02"
  },
  {
    listing_id: 4,
    listingName: "Listing 4",
    owner_id: 1,
    ownerName: "owner1",
    status: "Active",
    reported_by: "member 10",
    reported_date: "2026-07-01"
  }
];

const violations: {
    violation_id: number, violationName: string, listing_id: number, listingName: string, owner_id: number, ownerName: string, owner_violation_count: number, owner_status: string, recent_violation_date: string
}[] = [
  {
    violation_id: 1, 
    violationName: "inappropriate listing", 
    listing_id: 41, 
    listingName: "Tool 41", 
    owner_id: 43, 
    ownerName: "member43", 
    owner_violation_count: 5, 
    owner_status: "Active",
    recent_violation_date: "2026-07-12"
  },
 {
    violation_id: 2, 
    violationName: "inappropriate listing", 
    listing_id: 51, 
    listingName: "Tool 51", 
    owner_id: 21, 
    ownerName: "member21", 
    owner_violation_count: 1, 
    owner_status: "Active",
    recent_violation_date: "2026-07-07"
  },
  {
    violation_id: 3, 
    violationName: "inappropriate listing", 
    listing_id: 3, 
    listingName: "Tool 3", 
    owner_id: 1, 
    ownerName: "member1", 
    owner_violation_count: 4, 
    owner_status: "Suspended",
    recent_violation_date: "2026-07-01"
  },
  {
    violation_id: 4, 
    violationName: "inappropriate listing", 
    listing_id: 4, 
    listingName: "Tool 4", 
    owner_id: 18, 
    ownerName: "member18", 
    owner_violation_count: 1, 
    owner_status: "Active",
    recent_violation_date: "2026-07-29"
  }
];

const suspensions: {
    listing_id: number, listingName: string, owner_id: number, ownerName: string, status: string, recent_suspended_date: string
}[] = [
  {
    listing_id: 1,
    listingName: "Listing 1",
    owner_id: 1,
    ownerName: "owner1",
    status: "Active",
    recent_suspended_date: "2026-07-01"
  },
 {
    listing_id: 2,
    listingName: "Listing 2",
    owner_id: 2,
    ownerName: "owner2",
    status: "Deactivated",
    recent_suspended_date: "2026-07-29"
  },
  {
    listing_id: 3,
    listingName: "Listing 3",
    owner_id: 3,
    ownerName: "owner3",
    status: "Active",
    recent_suspended_date: "2026-06-01"
  },
  {
    listing_id: 4,
    listingName: "Listing 4",
    owner_id: 1,
    ownerName: "owner1",
    status: "Active",
    recent_suspended_date: "2026-07-11"
  }
];

const borrowingActivities: {
    listing_id: number, listingName: string, owner_id: number, ownerName: string, borrower_id: number, borrowerName: string, status: string, recent_status_update_date: string
}[] = [
  {
    listing_id: 1, 
    listingName: "Listing 1", 
    owner_id: 1, 
    ownerName: "member 1", 
    borrower_id: 2, 
    borrowerName: "member 2", 
    status: "Requested",
    recent_status_update_date: "2026-07-28"
  },
 {
    listing_id: 2, 
    listingName: "Listing 2", 
    owner_id: 2, 
    ownerName: "member 2", 
    borrower_id: 3, 
    borrowerName: "member 3", 
    status: "Approved",
    recent_status_update_date: "2026-07-26"
  },
  {
    listing_id: 3, 
    listingName: "Listing 3", 
    owner_id: 4, 
    ownerName: "member 4", 
    borrower_id: 5, 
    borrowerName: "member 5", 
    status: "Returned",
    recent_status_update_date: "2026-07-25"
  },
  {
    listing_id: 6, 
    listingName: "Listing 6", 
    owner_id: 5, 
    ownerName: "member 5", 
    borrower_id: 8, 
    borrowerName: "member 8", 
    status: "Requested",
    recent_status_update_date: "2026-07-30"
  }
];

type ReportType = "listings" | "violations" | "suspensions" | "borrowingActivities"
  
// User Story 33 / Issue #60: Admin Moderation Analytics Report.
function AdminModerationAnalyticsPage() {
  const [reportType, setReportType] = useState<ReportType>("listings");
  const [date, setDate] = useState("");

  const resetFilters = () => {
    setReportType("listings");
    setDate("");
  }

  const getAppropriateData = () => {
    switch (reportType) {
        case "violations": return filteredViolations;
        case "suspensions": return filteredSuspensions;
        case "borrowingActivities": return filteredBorrowingActivities;
        default: return filteredListings;
    }
  }

  const dateFieldByType: Record<ReportType, string> = {
    listings: "reported_date",
    violations: "recent_violation_date",
    suspensions: "recent_suspended_date",
    borrowingActivities: "recent_status_update_date"
  }

  const getFilteredData = <T extends Record<string, string | number>>(data: T[]): T[] =>{
    if(!date) return data;
    const field = dateFieldByType[reportType];
    return data.filter((row) => row[field]===date);
  }

  const filteredListings = reportType === "listings" ? getFilteredData(listings) : listings;
  const filteredViolations = reportType === "violations" ? getFilteredData(violations) : violations;
  const filteredSuspensions = reportType === "suspensions" ? getFilteredData(suspensions) : suspensions;
  const filteredBorrowingActivities = reportType === "borrowingActivities" ? getFilteredData(borrowingActivities) : borrowingActivities;

  const exportCSV = () => {
    const blob = new Blob([Papa.unparse<Record<string, string | number>>(getAppropriateData())], {type: "text/csv"});
    const url = URL.createObjectURL(blob);

    Object.assign(document.createElement("a"), {
        href: url,
        download: "ModerationAnalytics.csv"
    }).click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <section className="page-section">
        <div className="page-header">
          <div>
            <p className="eyebrow">User Story 33</p>
            <h1>Moderation Analytics</h1>
            <p className="page-description">Admin can generate community moderation reports and export it as CSV</p>
          </div>
        </div>

        <div className="filter-panel">
          <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
            <option value="listings">Listings</option>
            <option value="violations">Violations</option>
            <option value="suspensions">Suspensions</option>
            <option value="borrowingActivities">Borrowing activity</option>
          </select>
          <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="secondary-button" onClick={resetFilters}>Clear Filters</button>
        </div>

        {reportType === "listings" && (
        <div className="responsive-table-wrapper">
          <h2>Listings</h2>
          <table className="invite-table">
            <thead>
              <tr>
                <th>Listing ID</th>
                <th>Listing Name</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Reported By</th>
                <th>Reported Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredListings.map((l) =>(
                 <tr key={l.listing_id}>
                  <td>{l.listing_id}</td>
                  <td>{l.listingName}</td>
                  <td>{l.ownerName}</td>
                  <td>{l.status}</td>
                  <td>{l.reported_by}</td>
                  <td>{l.reported_date}</td>
                 </tr> 
               ))}
               {filteredListings.length === 0 && (
                 <tr>
                   <td colSpan={6}>There are no matches.</td>
                 </tr>
               )}
            </tbody>
          </table>
          <p>Total: {filteredListings.length}</p>
        </div>
        )}

        {reportType === "violations" && (
        <div className="responsive-table-wrapper">
          <h2>Violations</h2>
          <table className="invite-table">
            <thead>
              <tr>
                <th>Violation ID</th>
                <th>Violation Name</th>
                <th>Listing ID</th>
                <th>Listing Name</th>
                <th>Owner ID</th>
                <th>Owner Name</th>
                <th>Owner's Violation Count</th>
                <th>Owner's Status</th>
                <th>Recent Violation Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredViolations.map((v) =>(
                 <tr key={v.violation_id}>
                  <td>{v.violation_id}</td>
                  <td>{v.violationName}</td>
                  <td>{v.listing_id}</td>
                  <td>{v.listingName}</td>
                  <td>{v.owner_id}</td>
                  <td>{v.ownerName}</td>
                  <td>{v.owner_violation_count}</td>
                  <td>{v.owner_status}</td>
                  <td>{v.recent_violation_date}</td>
                 </tr> 
               ))}
               {filteredViolations.length === 0 && (
                 <tr>
                   <td colSpan={9}>There are no matches.</td>
                 </tr>
               )}
            </tbody>
          </table>
          <p>Total: {filteredViolations.length}</p>
        </div>
        )}

        {reportType === "suspensions" && (
        <div className="responsive-table-wrapper">
          <h2>Suspensions</h2>
          <table className="invite-table">
            <thead>
              <tr>
                <th>Listing ID</th>
                <th>Listing Name</th>
                <th>Owner ID</th>
                <th>Owner Name</th>
                <th>Status</th>
                <th>Recent Suspended Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuspensions.map((s) =>(
                 <tr key={s.listing_id}>
                  <td>{s.listing_id}</td>
                  <td>{s.listingName}</td>
                  <td>{s.owner_id}</td>
                  <td>{s.ownerName}</td>
                  <td>{s.status}</td>
                  <td>{s.recent_suspended_date}</td>
                 </tr>
               ))}
               {filteredSuspensions.length === 0 && (
                 <tr>
                   <td colSpan={6}>There are no matches.</td>
                 </tr>
               )}
            </tbody>
          </table>
          <p>Total: {filteredSuspensions.length}</p>
        </div>
        )}

        {reportType === "borrowingActivities" && (
        <div className="responsive-table-wrapper">
          <h2>Borrowing Activity</h2>
          <table className="invite-table">
            <thead>
              <tr>
                <th>Listing ID</th>
                <th>Listing Name</th>
                <th>Owner ID</th>
                <th>Owner Name</th>
                <th>Borrower ID</th>
                <th>Borrower Name</th>
                <th>Status</th>
                <th>Recent Status Update Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredBorrowingActivities.map((b) =>(
                 <tr key={b.listing_id}>
                  <td>{b.listing_id}</td>
                  <td>{b.listingName}</td>
                  <td>{b.owner_id}</td>
                  <td>{b.ownerName}</td>
                  <td>{b.borrower_id}</td>
                  <td>{b.borrowerName}</td>
                  <td>{b.status}</td>
                  <td>{b.recent_status_update_date}</td>
                 </tr> 
               ))}
               {filteredBorrowingActivities.length === 0 && (
                 <tr>
                   <td colSpan={8}>There are no matches.</td>
                 </tr>
               )}
            </tbody>
          </table>
          <p>Total: {filteredBorrowingActivities.length}</p>
        </div>
        )}

        <button onClick={exportCSV}>Export</button>
      </section>
    </>
  )
}

export default AdminModerationAnalyticsPage