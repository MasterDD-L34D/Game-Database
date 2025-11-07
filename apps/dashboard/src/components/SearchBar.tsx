import { useCallback, type ChangeEvent, type KeyboardEvent } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearch } from '../providers/SearchProvider';

export default function SearchBar() {
  const { query, setQuery, commitQuery } = useSearch();

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, [setQuery]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitQuery();
  }, [commitQuery]);

  const handleBlur = useCallback(() => {
    commitQuery();
  }, [commitQuery]);

  return (
    <TextField
      placeholder="Cerca"
      fullWidth
      value={query}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      inputProps={{ 'aria-label': 'Cerca' }}
      sx={{ maxWidth: { md: 480 } }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </InputAdornment>
        ),
      }}
    />
  );
}
