import { hunspellChecker } from './checker'
import { checkWords, verdict, suggestions } from '../spell/spell-client'

export const localChecker = hunspellChecker({ checkWords, verdict, suggestions })
