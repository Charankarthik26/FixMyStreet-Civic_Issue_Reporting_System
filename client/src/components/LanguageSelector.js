import React from 'react';
import { FormControl, Select, MenuItem, Box, Typography } from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ' }
];

const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (event) => {
    const selectedLanguage = event.target.value;
    i18n.changeLanguage(selectedLanguage);
    localStorage.setItem('selectedLanguage', selectedLanguage);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <LanguageIcon color="action" />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={i18n.language}
          onChange={handleLanguageChange}
          displayEmpty
          variant="outlined"
          sx={{
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }
          }}
        >
          {languages.map((language) => (
            <MenuItem key={language.code} value={language.code}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2">
                  {language.nativeName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({language.name})
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default LanguageSelector;


