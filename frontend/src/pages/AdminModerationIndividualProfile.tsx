{/* Reference: https://www.geeksforgeeks.org/typescript/how-can-i-define-an-array-of-objects-in-typescript/ */}
import {useState} from "react";
import {Link, useParams} from "react-router-dom";

type Status = "suspended" | "notSuspended";

type ListingReviewStatus = "pending" | "valid" | "invalid";



type InappropriateListing = {
  reportId: number;
  listingName: string;
  date: string;
  reviewStatus: ListingReviewStatus;
}
;
type ModerationProfile = {
  memberId: number;
  memberName: string;
  countOfViolation: number;
  status: Status;
  reason: string;
  inappropriateListings: InappropriateListing[];
  suspendedTime: string | null;
};
  
  
const moderationProfilesArray: ModerationProfile[] = [
  {
    memberId: 1,
    memberName: "Member 1",
    countOfViolation: 1,
    status: "suspended",
    reason: "broke the rule",
    inappropriateListings: [ 
      {
        reportId: 1,
        listingName: "inappropriate tool 1",
        date: "2026-06-21",
        reviewStatus: "pending"
      },
      {
        reportId: 2,
        listingName: "inappropriate tool 2",
        date: "2026-06-21",
        reviewStatus: "valid"
      },
    ],
    suspendedTime: "2026-07-01T12:10:00.000Z"
  },
  {
    memberId: 2,
    memberName: "Member 1",
    countOfViolation: 0,
    status: "notSuspended",
    reason: "",
    inappropriateListings: [ 
    ],
    suspendedTime: null
  },
  {
    memberId: 3,
    memberName: "Member 1",
    countOfViolation: 0,
    status: "notSuspended",
    reason: "",
    inappropriateListings: [ 
      {
        reportId: 3,
        listingName: "inappropriate tool 3",
        date: "2026-06-25",
        reviewStatus: "pending"
      },
      {
        reportId: 1,
        listingName: "inappropriate tool 4",
        date: "2026-06-27",
        reviewStatus: "pending"
      },
    ],
    suspendedTime: null
  },
  {
    memberId: 4,
    memberName: "Member 1",
    countOfViolation: 1,
    status: "suspended",
    reason: "broke rule",
    inappropriateListings: [ 
      {
        reportId: 5,
        listingName: "inappropriate tool 5",
        date: "2026-06-28",
        reviewStatus: "valid"
      },
    ],
    suspendedTime: "2026-07-11T12:10:00.000Z"
  },
];
  

function AdminModerationIndividualProfile() {
  const {memberId} = useParams<{memberId: string}>();
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [moderationProfiles, setModerationProfiles] = useState<ModerationProfile[]>(moderationProfilesArray);
  const [showError, setShowError] = useState(false);

  const updateStatus = (memberId: number) => {
    const profile = moderationProfiles.find(
      (currentProfile) => currentProfile.memberId === memberId,
    );
  
    if(!profile){
      return;
    }
  
    const isSuspending = profile.status === "notSuspended";
    const enteredReason = reasons[memberId]?.trim() ?? "";
  
    if (isSuspending && enteredReason === ""){
      setShowError(true);
      return;
    }

    setShowError(false);
  
    setModerationProfiles((currentProfiles) => 
      currentProfiles.map((currentProfile) => 
        currentProfile.memberId === memberId
          ? {
            ...currentProfile,
            status: isSuspending ? "suspended" : "notSuspended",
            reason: isSuspending ? enteredReason : currentProfile.reason,
            suspendedTime: isSuspending ? new Date().toISOString() : currentProfile.suspendedTime,
            }
          : currentProfile,
      ), 
    );
  
    setReasons((currentReasons) =>({
      ...currentReasons,
      [memberId]: ""
    }));
  }; 


  if(!memberId){
    return (
      <section className="page-section">
        <h1>Member not found</h1>
        <Link to="/admin/AdminModerationProfiles" className="approve-button"><button>Return</button></Link>
      </section>
    )
  }

  const numericMemberId = Number(memberId);

  if(Number.isNaN(numericMemberId)){
    return(
      <section className="page-section">
          <h1>Member not found</h1>
          <Link to="/admin/AdminModerationProfiles" className="approve-button"><button>Return</button></Link>
      </section>
    )
  }

  const profile = moderationProfiles.find(
    (currentProfile) =>
      currentProfile.memberId === numericMemberId,
  )

  if(!profile){
    return(
      <section className="page-section">
        <h1>Member not found</h1>
        <Link to="/admin/AdminModerationProfiles" className="approve-button"><button>Return</button></Link>
      </section>
    )
  }

  const updateListingReviewStatus = (
    memberId: number,
    reportId: number,
    reviewStatus: ListingReviewStatus,
  ) => {
    setModerationProfiles((currentProfiles) =>
      currentProfiles.map((currentProfile) => {
        if(currentProfile.memberId !== memberId) {
          return currentProfile;
        }

        const updatedListings = 
          currentProfile.inappropriateListings.map((listing) => 
            listing.reportId === reportId 
               ? {
                 ...listing,
                 reviewStatus,
               }
              : listing,
      );
    
      return {
        ...currentProfile,
        inappropriateListings: updatedListings,

        countOfViolation: updatedListings.filter(
          (listing) => listing.reviewStatus === "valid",
        ).length,
      };
      }));
  };
    
  return (
    <>
      <section className="page-section">
        <div className="page-header">
          <div>
            <p className="eyebrow">User Story 29, 30, 31</p>
            <h1>Admin Members Moderation Page</h1>
            <p className="page-description">Admin can suspend and reactivate members who repeatedly violate community rules</p>
          </div>
        </div>

        <table className="invite-table">
          <tbody>
            <tr>
              <th>Member ID</th>
              <td>{profile.memberId}</td>
            </tr>
            <tr>
              <th>Member Name</th>
              <td>{profile.memberName}</td>
            </tr>
            <tr>
              <th>Violation Count</th>
              <td>{profile.countOfViolation}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>{profile.status}</td>
            </tr>   
            <tr>
              <th>Reason for being suspended</th>
              <td>{profile.status === "suspended" ? profile.reason :  ""}</td>
            </tr>
            <tr>
              <th>Reported Inapproriate Listings </th>
              <td>{profile.inappropriateListings.length > 0 ? (
                <div>
                  {profile.inappropriateListings.map((listing) => (
                    <div key={listing.reportId}>
                      <div>
                        <strong>{listing.listingName}</strong>
                        {" - "}
                        {listing.date}

                        <p>Decision: {listing.reviewStatus === "pending" ? "Pending" : listing.reviewStatus === "valid" ? "Valid" : "Invalid"}</p>
                      </div>

                      <div>
                        <button className="danger-button" disabled={listing.reviewStatus === "valid"} onClick={()=> updateListingReviewStatus(profile.memberId, listing.reportId, "valid")}>Valid</button>
                        <button className="button invalid-button" disabled={listing.reviewStatus === "invalid"} onClick={()=> updateListingReviewStatus(profile.memberId, listing.reportId, "invalid")}>Invalid</button>
                      </div>
                    </div>
                    ))}
                </div>
              ) :( <span>No inappropriate listings</span>)}
              </td>
            </tr>
            <tr>
              <th>Suspended Time</th>
              <td>{profile.suspendedTime ? new Date(profile.suspendedTime).toLocaleDateString("en-US",{timeZone: "Pacific/Honolulu"}) :  "Not suspended"}</td>
            </tr>
          </tbody>
        </table>

        <h3>Reason to suspend</h3>
        <input type="text" className="profile-reason-input margin-bottom-admin-moderation-input" value={reasons[profile.memberId] ?? ""} placeholder={profile.status === "suspended" ? "No need to enter for reactivation" : "Enter a reason for suspension"} disabled={profile.status === "suspended"} onChange={(event)=>setReasons((currentReasons) => ({...currentReasons, [profile.memberId]: event.target.value}))} />
        <button className={profile.status === "suspended" ? "approve-button" : "danger-button"} onClick={() => updateStatus(profile.memberId)}>{profile.status === "suspended" ? "Reactivate" : "Suspend"}</button>
        <Link to="/admin/AdminModerationProfiles" className="action-button"><button type="button">Return to Moderation lists</button></Link>
      </section>

      <section className={showError ? "suspension-reason-error-message-visible active-date-conflict-list" : "suspension-reason-error-message-invisible"} aria-hidden={!showError}>
        <strong>Enter a reason for suspension</strong>
      </section>
    </>
  )
}

export default AdminModerationIndividualProfile