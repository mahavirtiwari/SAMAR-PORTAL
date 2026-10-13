// Single source of truth for the current user's role on an assessment team.
// Reads the assessment payload (online fetch or offline mirror — same shape),
// so it resolves identically with or without connectivity.
//
//   assessment — the assessment object (e.g. assessmentData.assessment, or a
//                Home list item). Carries `leadAssessor` + `teamMembers`.
//   userId     — the current user's id.
//
// Returns { isLead, isCoAssessor, isTeamMember, teamMemberId }.
//
// `leadAssessor` is the convenience field every screen historically compared
// against; we keep using it but fall back to the team-member role so a partial
// payload still identifies the lead, and we compare ids type-safely so a
// string/number drift can't flip the answer.
const sameId = (a, b) => a != null && b != null && Number(a) === Number(b);

export const resolveTeamRole = (assessment, userId) => {
  const empty = { isLead: false, isCoAssessor: false, isTeamMember: false, teamMemberId: null };
  if (!assessment || userId == null) {
    return empty;
  }

  const teamMembers = Array.isArray(assessment.teamMembers) ? assessment.teamMembers : [];
  const me = teamMembers.find((m) => sameId(m?.userId, userId) || sameId(m?.user?.id, userId));

  const isLead = sameId(assessment.leadAssessor?.id, userId) || me?.role === 'lead_assessor';
  const isTeamMember = !!me || isLead;

  return {
    isLead,
    isCoAssessor: isTeamMember && !isLead,
    isTeamMember,
    teamMemberId: me?.id ?? null
  };
};

// Normalises a team roster into the parameters-API shape the allocation /
// assignment screens render: { id, role, user: { id, firstName, lastName } }.
//
// The two sources disagree offline: the parameters endpoint nests names under
// `user.firstName`/`user.lastName`, but the mirrored assessment payload (the
// offline fallback) stores them flat as `{ id, userId, name (full name), role }`
// — so `item.user?.firstName` reads undefined and assessor names render blank
// without connectivity. Map both shapes here so callers get one shape either way.
// `id` stays the TEAM MEMBER id (what assignedToTeamMemberId references); the
// user id rides on `user.id` for the current-user filter.
export const normalizeTeamMembers = (rawMembers) =>
  (Array.isArray(rawMembers) ? rawMembers : []).map((m) => {
    const hasUserNames = m?.user?.firstName || m?.user?.lastName;
    const parts = String(m?.name || m?.full_name || '')
      .trim()
      .split(/\s+/);
    const userId = m?.userId ?? m?.user_id ?? m?.user?.id ?? null;
    return {
      id: m?.id ?? userId,
      role: m?.role,
      user: hasUserNames
        ? { id: m.user.id ?? userId, firstName: m.user.firstName, lastName: m.user.lastName }
        : { id: userId, firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
    };
  });

// True when a parameter is assigned to a given team member. Matches by the
// assignee's USER id first (param.assignedTeamMember.user.id — present online
// via eager-load and offline via the mirror), falling back to the membership id
// (assignedToTeamMemberId === member.id). The user-id path is essential offline:
// the mirrored roster carries no membership id (member.id falls back to the user
// id), so a membership-id-only comparison matches nothing and counts/lists read
// empty. Mirrors the matching used by the assessment home screens.
export const isParameterAssignedToMember = (param, member) => {
  if (!param || !member) {
    return false;
  }
  if (param.assignedToTeamMemberId == null && !param.assignedTeamMember) {
    return false;
  }
  const memberUserId = member.user?.id ?? member.userId ?? null;
  const assigneeUserId = param.assignedTeamMember?.user?.id;
  if (assigneeUserId != null && memberUserId != null) {
    return String(assigneeUserId) === String(memberUserId);
  }
  return member.id != null && String(param.assignedToTeamMemberId) === String(member.id);
};

export default resolveTeamRole;
