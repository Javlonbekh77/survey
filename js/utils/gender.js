export function inferGender(fullName) {
    if (!fullName) return 'boy';
    const name = fullName.trim().toLowerCase();
    
    // User requested exception: if name contains 'abdulla' or 'ali', it's a boy
    if (name.includes('abdulla') || name.includes('ali')) {
        return 'boy';
    }

    const parts = name.split(' ').filter(p => p.length > 0);
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    
    // User requested to only check the first two words (e.g. Surname and First name) 
    // to avoid misclassification from patronymics like "O'g'li" which end in 'i' but denote a boy.
    const wordsToCheck = parts.slice(0, 2);
    for (let part of wordsToCheck) {
        if (vowels.includes(part.slice(-1))) {
            return 'girl';
        }
    }
    
    return 'boy';
}
