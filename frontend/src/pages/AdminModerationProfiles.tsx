{/* Reference: https://www.geeksforgeeks.org/typescript/how-can-i-define-an-array-of-objects-in-typescript/ */}

import {Link} from "react-router-dom";
type Status = "suspended" | "notSuspended";

type ModerationProfile = {
  memberId: number;
  memberName: string;
  countOfViolation: number;
  status: Status;
  reason: string;
};


const moderationProfilesArray: ModerationProfile[] = [
  {
    memberId: 1,
    memberName: "Member 1",
    countOfViolation: 5,
    status: "suspended",
    reason: "broke the rule"
  },
  {
    memberId: 2,
    memberName: "Member 1",
    countOfViolation: 5,
    status: "notSuspended",
    reason: ""
  },
  {
    memberId: 3,
    memberName: "Member 1",
    countOfViolation: 2,
    status: "notSuspended",
    reason: ""
  },
  {
    memberId: 4,
    memberName: "Member 1",
    countOfViolation: 8,
    status: "suspended",
    reason: "broke rule"
  },
];


function AdminModerationProfiles() {
  return (
    <>
      <section className="page-section">
        <div className="page-header">
          <div>
            <p className="eyebrow">User Story 30, 31</p>
            <h1>Admin Members Moderation Page</h1>
            <p className="page-description">Admin can suspend and reactivate members who repeatedly violate community rules</p>
          </div>
        </div>
      
        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Affected Member</th>
                <th>Violation Count</th>
                <th>Status</th>
                <th>Reason to suspend</th>
                <th>Update Status</th>
              </tr>
            </thead>

            <tbody>
              {moderationProfilesArray.map((moderation) =>(
                <tr key={moderation.memberId}>
                  <td>{moderation.memberId}</td>
                  <td>{moderation.memberName}</td>
                  <td>{moderation.countOfViolation}</td>
                  <td>{moderation.status}</td>
                  <td>{moderation.status === "suspended" ? moderation.reason :  ""}</td>
                  <td><Link to={`/admin/AdminModerationProfiles/${moderation.memberId}`}><button>Details</button></Link></td>
                </tr>
              ))}
              {moderationProfilesArray.length === 0 && (
                <tr>
                  <td>There is no profiles</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default AdminModerationProfiles