export const _sig = [76, 97, 111, 83, 104, 117, 105]
export const _sys = [86, 111, 105, 99, 101, 72, 117, 98]
export const _repo = [
  104, 116, 116, 112, 115, 58, 47, 47, 103, 105, 116, 104, 117, 98, 46, 99, 111, 109, 47, 108, 97,
  111, 115, 104, 117, 105, 107, 97, 105, 120, 117, 101, 47, 86, 111, 105, 99, 101, 72, 117, 98
]

export const getCopyrightOwner = () => String.fromCharCode(..._sig)
export const getSystemName = () => String.fromCharCode(..._sys)
export const getRepoUrl = () => String.fromCharCode(..._repo)
